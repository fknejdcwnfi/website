"""Functional regression checks against a running Vite dev server (source-module probes)."""
import argparse,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:5173/')
args=parser.parse_args()
ROOT=args.url.rstrip('/')+'/'
OUT=Path('/tmp/portrait-qa');OUT.mkdir(exist_ok=True)
results={'checks':[],'errors':[]}
def ok(name, condition=True, detail=None):
 assert condition, (name,detail)
 results['checks'].append(name)
 if detail is not None:results[name]=detail
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1200,'height':1000})
 page.on('pageerror',lambda e:results['errors'].append(str(e)))
 page.on('response',lambda r:results['errors'].append(f'HTTP {r.status} {r.url}') if r.status>=400 else None)
 page.goto(ROOT+'?t=0');page.wait_for_selector('canvas[data-ready=true]')
 ok('defaultportrait',page.locator('canvas').get_attribute('data-style')=='portrait')
 ok('no_public_ui',page.locator('button,summary,input,.hud').count()==0)
 ok('pixelated_grid',page.locator('canvas').evaluate('(c)=>c.width===256&&c.height===256&&getComputedStyle(c).imageRendering==="pixelated"'))
 native=page.locator('canvas').evaluate('(c)=>c.toDataURL()')
 for size in [192,256,320]:
  page.goto(ROOT+f'?t=0&pixel={size}');page.wait_for_selector('canvas[data-ready=true]')
  ok(f'grid_{size}',page.locator('canvas').evaluate('(c)=>c.width')==size)
  page.screenshot(path=str(OUT/f'grid-{size}.png'))
 page.goto(ROOT+'?pose=10');page.wait_for_selector('canvas[data-ready=true]')
 ok('rest_1_equals_10',native==page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
 metrics=page.evaluate('''async()=>{
 const {PortraitRig,HAIR_REGIONS}=await import('/src/character/portraitRig.ts');
 const {loadImage}=await import('/src/character/portraitAsset.ts');
 const {createMotionTable}=await import('/src/animation/portraitTimeline.ts');
 const [open,closed]=await Promise.all([loadImage('/assets/portrait/base.png'),loadImage('/assets/portrait/eyelids.png')]);
 const rig=new PortraitRig(open,closed,256), canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d');
 const table=createMotionTable({direction:1,gust:.35,stiffness:18,damping:5});
 const render=(t,gain=1,eye=1)=>{rig.paint(ctx,table,t,gain,eye);return new Uint32Array(ctx.getImageData(0,0,256,256).data.buffer)};
 const a=render(0),gust=render(1020),b=render(740),blink=render(740,1,0),last=render(1890),wrap=render(2300),zero=render(1020,0);
 const counts=Array(9).fill(0);let protectedChanged=0,protectedCount=0,blinkChanged=0,outsideEyes=0,windChanged=0,rootChanged=0;
 for(let i=0;i<a.length;i++){
  if(a[i]!==gust[i]){windChanged++;if(rig.groups[i]>=0)counts[rig.groups[i]]++;}
  if(rig.protectedPixels[i]){protectedCount++;if(a[i]!==gust[i])protectedChanged++;}
  if(b[i]!==blink[i]){blinkChanged++;const x=i%256,y=Math.floor(i/256);if(!((x>=63&&x<=105&&y>=66&&y<=88)||(x>=137&&x<=184&&y>=60&&y<=84)))outsideEyes++;}
  if(rig.weights[i]===0&&a[i]!==gust[i])rootChanged++;
 }
 return {windChanged,counts,protectedChanged,protectedCount,blinkChanged,outsideEyes,rootChanged,
 finalEqualsRest:a.every((v,i)=>v===last[i]),wrapEqualsRest:a.every((v,i)=>v===wrap[i]),zeroWindEqualsRest:a.every((v,i)=>v===zero[i])};
}''')
 results['rig']=metrics
 ok('wind_moves_real_pixels',metrics['windChanged']>100,metrics['windChanged'])
 ok('fixed_face_skin_necklace',metrics['protectedChanged']==0,metrics['protectedCount'])
 ok('roots_fixed',metrics['rootChanged']==0)
 ok('blink_only_local_eyes',metrics['blinkChanged']>100 and metrics['outsideEyes']==0,metrics['blinkChanged'])
 ok('seam_and_settled_rest',metrics['finalEqualsRest'] and metrics['wrapEqualsRest'])
 ok('zero_wind_static_hair_ears',metrics['zeroWindEqualsRest'])
 ok('earring_pixels_move',metrics['counts'][8]>0,metrics['counts'][8])
 ok('independent_hair_groups_move',sum(c>0 for c in metrics['counts'][:8])>=5,metrics['counts'])
 page.goto(ROOT+'?debug=1');page.wait_for_selector('canvas[data-ready=true]')
 before=page.locator('.hud').inner_text();page.wait_for_timeout(300)
 ok('live_timeline_progresses',before!=page.locator('.hud').inner_text())
 page.locator('summary').click();ok('hidden_debug_panel_opens',page.locator('input[type=range]').count()==6)
 ok('debug_sliders_labelled',page.locator('input[type=range]').evaluate_all('(xs)=>xs.every(x=>x.closest("label"))'))
 page.get_by_role('button',name='暫停',exact=True).click();page.wait_for_selector('canvas[data-ready=true]');page.wait_for_timeout(200)
 frozen=page.locator('canvas').evaluate('(c)=>c.toDataURL()');page.wait_for_timeout(200)
 ok('pause_preserves_current_pose',frozen!=native)
 ok('pause_stable',frozen==page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
 # The manual blink is asynchronous but should change the eye patch then restore it.
 page.get_by_role('button',name='眨眼',exact=True).click();page.wait_for_timeout(100)
 closed=page.locator('canvas').evaluate('(c)=>c.toDataURL()');page.wait_for_timeout(220)
 ok('manual_blink_local_and_restores',closed!=frozen and frozen==page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
 page.get_by_role('button',name='繼續',exact=True).click();page.wait_for_selector('canvas[data-ready=true]');page.wait_for_timeout(250)
 ok('resume_advances',frozen!=page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
 # Initial reduced motion must not schedule any portrait animation frame.
 reduced=b.new_context(viewport={'width':1200,'height':1000},reduced_motion='reduce')
 reduced.add_init_script('window.__raf=0;const r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=(cb)=>{window.__raf++;return r(cb)}')
 rp=reduced.new_page();rp.goto(ROOT);rp.wait_for_selector('canvas[data-ready=true]');rp.wait_for_timeout(150)
 reduced_start=rp.locator('canvas').evaluate('(c)=>c.toDataURL()');rp.wait_for_timeout(200)
 ok('initial_reduced_motion_static',reduced_start==rp.locator('canvas').evaluate('(c)=>c.toDataURL()'))
 ok('initial_reduced_motion_zero_raf',rp.evaluate('window.__raf')==0,rp.evaluate('window.__raf'))
 rp.emulate_media(reduced_motion='no-preference');rp.wait_for_timeout(500)
 ok('live_reduced_motion_resume',rp.locator('canvas').evaluate('(c)=>c.toDataURL()')!=reduced_start)
 rp.emulate_media(reduced_motion='reduce');rp.wait_for_timeout(50)
 after=rp.locator('canvas').evaluate('(c)=>c.toDataURL()');rp.wait_for_timeout(150)
 ok('live_reduced_motion_stop',after==rp.locator('canvas').evaluate('(c)=>c.toDataURL()') and after==reduced_start)
 reduced.close()
 # A fresh page tests explicit seek static mode and destroy/visibility via actual player.
 page.goto(ROOT+'?t=740');page.wait_for_selector('canvas[data-ready=true]')
 seek=page.locator('canvas').evaluate('(c)=>c.toDataURL()');page.wait_for_timeout(120)
 ok('seek_static',seek==page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
 lifecycle=page.evaluate('''async()=>{
 const {PortraitPlayer}=await import('/src/animation/portraitPlayer.ts');const{readStageOptions}=await import('/src/animation/stageOptions.ts');
 const c=document.createElement('canvas');document.body.append(c);let count=0;const player=new PortraitPlayer(c,readStageOptions(''),()=>{count++});
 await new Promise(r=>setTimeout(r,500));const running=count;
 Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
 await new Promise(r=>setTimeout(r,250));const hidden=count;
 Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
 await new Promise(r=>setTimeout(r,300));const resumed=count;
 player.destroy();const stopped=count;await new Promise(r=>setTimeout(r,250));const destroyed=count;c.remove();delete document.hidden;
 return{running,hidden,resumed,stopped,destroyed};
}''')
 ok('hidden_resume_destroy_lifecycle',lifecycle['running']>0 and lifecycle['hidden']==lifecycle['running'] and lifecycle['resumed']>lifecycle['hidden'] and lifecycle['destroyed']==lifecycle['stopped'],lifecycle)
 # Drive the real player at two refresh rates with identical simulated elapsed time.
 refresh=page.evaluate("""async()=>{
 const{PortraitPlayer}=await import('/src/animation/portraitPlayer.ts');const{readStageOptions}=await import('/src/animation/stageOptions.ts');
 const originalRAF=window.requestAnimationFrame,originalCancel=window.cancelAnimationFrame;
 const run=async(hz)=>{let id=0;const queue=new Map();window.requestAnimationFrame=cb=>{queue.set(++id,cb);return id};window.cancelAnimationFrame=id=>queue.delete(id);
 const c=document.createElement('canvas'),player=new PortraitPlayer(c,readStageOptions(''));
 try{for(let i=0;c.dataset.ready!=='true'&&i<500;i++)await new Promise(r=>setTimeout(r,10));if(c.dataset.ready!=='true')throw Error('player load timeout');
 for(let frame=0;frame<=hz;frame++){const callbacks=[...queue.values()];queue.clear();callbacks.forEach(cb=>cb(1000+frame*1000/hz))}
 return{elapsed:player.elapsed,pixels:c.toDataURL()};}finally{player.destroy();}};
 try{const a=await run(60),b=await run(120);return{elapsed60:a.elapsed,elapsed120:b.elapsed,identical:a.pixels===b.pixels};}
 finally{window.requestAnimationFrame=originalRAF;window.cancelAnimationFrame=originalCancel;}
 }""")
 ok('refresh_60_120_same_speed_and_pixels',abs(refresh['elapsed60']-1000)<.001 and abs(refresh['elapsed120']-1000)<.001 and refresh['identical'],refresh)
 for style in ['voxel','legacy']:
  page.goto(ROOT+f'?style={style}&pose=5');page.wait_for_timeout(600)
  ok('archive_'+style,page.locator('canvas').get_attribute('data-style')==style and page.locator('canvas').evaluate('(c)=>c.getContext("2d").getImageData(100,100,1,1).data[3]')>0)
 mobile=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
 mobile.goto(ROOT+'?t=1020');mobile.wait_for_selector('canvas[data-ready=true]')
 box=mobile.locator('.stage').bounding_box()
 ok('mobile_complete_no_overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth') and box['x']>=0 and box['y']>=0 and box['x']+box['width']<=390 and box['y']+box['height']<=844,box)
 mobile.screenshot(path=str(OUT/'mobile-final.png'));mobile.close()
 ok('no_browser_errors',not results['errors'],results['errors'])
 b.close()
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
(Path(__file__).resolve().parent.parent/'artifacts'/'qa.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False))
