"""Exercise reference-scene player lifecycle with a local high-definition image and deterministic renderer.

Use a Vite development URL: source modules are imported intentionally. This is a
lifecycle test, not motion-art fidelity or physical-refresh-rate verification.
"""
import argparse
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:5180/')
parser.add_argument('--output',type=Path,default=Path('artifacts/scenic-snow/player-lifecycle.json'))
args=parser.parse_args()
base=args.url.rstrip('/')
import io,json
from PIL import Image
from playwright.sync_api import sync_playwright
manifest=json.loads((Path(__file__).resolve().parents[2]/'public/assets/reference-scene/source-manifest.json').read_text())
png=io.BytesIO();Image.new('RGB',(manifest['width']*2,manifest['height']*2),'#51647e').save(png,format='PNG')
checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def setup(reduced='no-preference'):
  c=b.new_context(viewport={'width':1200,'height':1000},reduced_motion=reduced);q=c.new_page();q.route('**/__scene-test.png',lambda r:r.fulfill(content_type='image/png',body=png.getvalue()));q.route('**/__scene-lifecycle.html',lambda r:r.fulfill(content_type='text/html',body='<html><body></body></html>'));q.goto(base+'/__scene-lifecycle.html');q.evaluate('''async()=>{
   const {ScenePlayer}=await import('/src/features/referenceScene/ScenePlayer.ts');window.ScenePlayer=ScenePlayer;
   const{SCENE_WIDTH,SCENE_HEIGHT}=await import('/src/features/referenceScene/types.ts');
   window.definition={version:1,width:SCENE_WIDTH,height:SCENE_HEIGHT,canonical:{src:'/__scene-test.png',width:SCENE_WIDTH,height:SCENE_HEIGHT},description:'test',motionSource:'reconstructed'};
   window.testCanvas=document.createElement('canvas');document.body.append(testCanvas);window.paintCount=0;window.prepares=0;window.destroyCalls=0;window.samples=[];
   window.factory=async()=>{prepares++;return{paint(ctx,s){paintCount++;samples.push(s.elapsedMs);ctx.fillStyle='#bbccdd';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height)},destroy(){destroyCalls++}}};
   window.subject=new ScenePlayer(testCanvas,definition,factory);
  }''');return c,q
 c,q=setup();q.wait_for_function("testCanvas.dataset.playback==='looping'");q.wait_for_timeout(150);assert q.evaluate('paintCount>2&&prepares===1');checks.append('normal_looping')
 advance=q.evaluate('''()=>{cancelAnimationFrame(subject.raf);const before=samples.at(-1);subject.lastTime=performance.now()-450;subject.tick(performance.now());return samples.at(-1)-before}''')
 assert 400<advance<500,advance;checks.append('visible_delayed_frame_keeps_source_wall_clock')
 high_refresh=q.evaluate('''()=>{cancelAnimationFrame(subject.raf);subject.elapsedMs=0;subject.lastTime=1000;const before=paintCount;for(let index=1;index<=144;index++){cancelAnimationFrame(subject.raf);subject.tick(1000+index*1000/144)}return{paints:paintCount-before,elapsedMs:samples.at(-1)}}''')
 assert high_refresh['paints']==144 and abs(high_refresh['elapsedMs']-1000)<1e-6,high_refresh;checks.append('simulated_144hz_callbacks_are_not_throttled_or_time_stretched')
 q.evaluate("subject.setViewportVisible(false)");q.wait_for_timeout(60);n=q.evaluate('paintCount');q.wait_for_timeout(150);assert q.evaluate('paintCount')==n;checks.append('offscreen_stops_painting')
 q.evaluate('subject.setViewportVisible(true)');q.wait_for_timeout(80);assert q.evaluate('paintCount')>n;checks.append('visible_resumes')
 q.evaluate("window.fakeHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fakeHidden});document.dispatchEvent(new Event('visibilitychange'))");n=q.evaluate('paintCount');last=q.evaluate('samples.at(-1)');q.wait_for_timeout(200);assert q.evaluate('paintCount')==n
 q.evaluate("window.fakeHidden=false;document.dispatchEvent(new Event('visibilitychange'))");q.wait_for_timeout(60);assert q.evaluate('samples.at(-1)')-last<120;checks.append('hidden_preserves_phase')
 q.evaluate('subject.destroy()');n=q.evaluate('paintCount');q.wait_for_timeout(120);assert q.evaluate('paintCount')==n and q.evaluate('destroyCalls')==1;checks.append('destroy_cleans_renderer_and_raf');c.close()
 c,q=setup('reduce');q.wait_for_function("testCanvas.dataset.playback==='static'");canonical=q.evaluate('testCanvas.toDataURL()');assert q.evaluate('prepares')==0;checks.append('reduced_motion_skips_preparation')
 q.evaluate('subject.setMotionEnabled(true)');q.wait_for_function("testCanvas.dataset.playback==='looping'");q.wait_for_timeout(80);assert q.evaluate('prepares===1&&paintCount>0');checks.append('explicit_choice_enables_animation')
 q.evaluate('subject.setMotionEnabled(false)');q.wait_for_function("testCanvas.dataset.playback==='static'");assert q.evaluate('testCanvas.toDataURL()')==canonical;checks.append('system_choice_restores_canonical')
 q.evaluate('subject.setMotionEnabled(true)');q.wait_for_function("testCanvas.dataset.playback==='looping'");assert q.evaluate('prepares')==1;checks.append('choice_reuses_renderer');q.evaluate('subject.destroy()');c.close()
 c,q=setup();q.wait_for_function("testCanvas.dataset.playback==='looping'");q.evaluate('''subject.destroy();window.lateDisposed=0;window.late=new ScenePlayer(testCanvas,definition,()=>new Promise(resolve=>{window.complete=()=>resolve({paint(){},destroy(){lateDisposed++}})}));''');q.wait_for_function('typeof complete===\"function\"');q.evaluate('late.destroy();complete()');q.wait_for_timeout(50);assert q.evaluate('lateDisposed')==1;checks.append('stale_async_renderer_is_destroyed')
 q.evaluate("window.failed=new ScenePlayer(testCanvas,definition,async()=>{throw Error('test failure')})");q.wait_for_function("testCanvas.dataset.playback==='failed'");checks.append('factory_failure_is_explicit');c.close()
 c,q=setup();q.wait_for_function("testCanvas.dataset.playback==='looping'");q.evaluate('''subject.destroy();window.pendingStarts=0;window.cancelledPreparations=0;
   window.pending=new ScenePlayer(testCanvas,definition,(_assets,signal)=>new Promise((resolve,reject)=>{pendingStarts++;window.resolvePending=resolve;window.rejectPending=reject;signal.addEventListener('abort',()=>cancelledPreparations++)}));''');q.wait_for_function('pendingStarts===1')
 q.emulate_media(reduced_motion='reduce');q.wait_for_function("testCanvas.dataset.playback==='static'");q.evaluate("rejectPending(Error('outdated failure'))");q.wait_for_timeout(50);assert q.evaluate("testCanvas.dataset.playback==='static'&&cancelledPreparations===1");checks.append('preference_cancels_preparation_and_ignores_outdated_error')
 q.emulate_media(reduced_motion='no-preference');q.wait_for_function('pendingStarts===2');q.evaluate('resolvePending({paint(){}})');q.wait_for_function("testCanvas.dataset.playback==='looping'");checks.append('preference_restarts_cancelled_preparation');q.evaluate('pending.destroy()');c.close()
 c,q=setup();q.wait_for_function("testCanvas.dataset.playback==='looping'");q.evaluate('''subject.destroy();window.samples=[];window.handoffReads=0;window.handoff=new ScenePlayer(testCanvas,definition,factory,{initialElapsedMs:()=>{handoffReads++;return 640}})''');q.wait_for_function("testCanvas.dataset.playback==='looping'");assert q.evaluate('handoffReads===1&&samples[0]===640');checks.append('preview_phase_is_sampled_at_first_dynamic_paint')
 q.evaluate('handoff.setViewportVisible(false);handoff.setViewportVisible(true)');q.wait_for_timeout(50);assert q.evaluate('handoffReads')==1;checks.append('preview_phase_is_not_restarted_on_visibility_resume')
 q.evaluate('handoff.destroy();window.samples=[];window.seekHandoffReads=0;window.inspection=new ScenePlayer(testCanvas,definition,factory,{timeMs:80,initialElapsedMs:()=>{seekHandoffReads++;return 640}})');q.wait_for_function("testCanvas.dataset.playback==='static'");assert q.evaluate('seekHandoffReads===0&&samples[0]===80');checks.append('explicit_seek_does_not_read_progressive_preview_phase');q.evaluate('inspection.destroy()');c.close()
 c,q=setup();q.wait_for_function("testCanvas.dataset.playback==='looping'");q.evaluate('''subject.destroy();window.hiddenHandoffReads=0;window.hiddenHandoff=new ScenePlayer(testCanvas,definition,()=>new Promise(resolve=>window.completeHidden=resolve),{initialElapsedMs:()=>{hiddenHandoffReads++;return 320}})''');q.wait_for_function('typeof completeHidden==="function"');q.evaluate("window.fakeHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fakeHidden});document.dispatchEvent(new Event('visibilitychange'));completeHidden({paint(ctx,s){samples.push(s.elapsedMs)}})");q.wait_for_function("testCanvas.dataset.playback==='suspended'");q.wait_for_timeout(30);assert q.evaluate('hiddenHandoffReads')==0;checks.append('hidden_preparation_does_not_consume_preview_phase')
 q.evaluate("window.samples=[];window.fakeHidden=false;document.dispatchEvent(new Event('visibilitychange'))");q.wait_for_function("testCanvas.dataset.playback==='looping'");assert q.evaluate('hiddenHandoffReads===1&&samples[0]===320');checks.append('visible_upgrade_reads_current_preview_phase');q.evaluate('hiddenHandoff.destroy()')
 for mode in ['throws','nan','negative']:
  q.evaluate('''mode=>{window.samples=[];window.optionalPreview=new ScenePlayer(testCanvas,definition,factory,{initialElapsedMs:()=>{if(mode==='throws')throw Error('optional preview failed');return mode==='nan'?NaN:-20}})}''',mode);q.wait_for_function("testCanvas.dataset.playback==='looping'");assert q.evaluate('samples[0]')==0;q.evaluate('optionalPreview.destroy()')
 checks.append('invalid_optional_preview_clock_cannot_stop_motion');c.close();b.close()
result={'status':'passed','scope':'ScenePlayer lifecycle with a fixture image and test renderer; not visual fidelity or device FPS','checks':checks}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
