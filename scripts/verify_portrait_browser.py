"""Functional regression checks against a running Vite dev server (source-module probes)."""
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
def portrait_url(url):
    parts=urlsplit(url)
    query=dict(parse_qsl(parts.query))
    query['view']='portrait'
    return urlunsplit((parts.scheme,parts.netloc,parts.path,urlencode(query),parts.fragment))

import argparse, atexit, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5173/')
args = parser.parse_args()
ROOT = args.url.rstrip('/') + '/'
OUT = Path('/tmp/rich-motion-qa')
OUT.mkdir(exist_ok=True)
EVIDENCE = Path(__file__).resolve().parent.parent / 'artifacts' / 'rich-motion' / 'qa.json'
results = {'url': args.url, 'contract': 'layered reference wind, visible curls, fixed original face and binary pixels', 'status': 'failed', 'checks': [], 'errors': []}

def save_results():
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(results, ensure_ascii=False, indent=2) + '\n'
    EVIDENCE.write_text(serialized)
    (OUT / 'results.json').write_text(serialized)

atexit.register(save_results)

def ok(name, condition=True, detail=None):
    if not condition:
        results['failure'] = {'check': name, 'detail': detail}
    assert condition, (name, detail)
    results['checks'].append(name)
    if detail is not None:
        results[name] = detail
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = b.new_page(viewport={'width': 1200, 'height': 1000})
    page.on('pageerror', lambda e: results['errors'].append(str(e)))
    page.on('response', lambda r: results['errors'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    page.goto(portrait_url(ROOT + '?t=0'))
    page.wait_for_selector('canvas[data-ready=true]')
    ok('defaultportrait', page.locator('canvas').get_attribute('data-style') == 'portrait')
    ok('no_public_ui', page.locator('button,summary,input,.hud').count() == 0)
    ok('pixelated_grid', page.locator('canvas').evaluate('(c)=>c.width===256&&c.height===256&&getComputedStyle(c).imageRendering==="pixelated"'))
    native = page.locator('canvas').evaluate('(c)=>c.toDataURL()')
    for size in [192, 256, 320]:
        page.goto(portrait_url(ROOT + f'?t=0&pixel={size}'))
        page.wait_for_selector('canvas[data-ready=true]')
        ok(f'grid_{size}', page.locator('canvas').evaluate('(c)=>[c.width,c.height]') == [size, size])
        page.screenshot(path=str(OUT / f'grid-{size}.png'))
    page.goto(portrait_url(ROOT + '?pose=10'))
    page.wait_for_selector('canvas[data-ready=true]')
    ok('rest_1_equals_10', native == page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
    metrics = page.evaluate(r"""async()=>{
      const {PortraitRig,HAIR_REGIONS,EYES,inside}=await import('/src/character/portraitRig.ts');
      const {loadImage,PALETTE}=await import('/src/character/portraitAsset.ts');
      const {createMotionTable,samplePortrait,KEY_TIMES,LOOP_MS}=await import('/src/animation/portraitTimeline.ts');
      const [open,closed,underpaint]=await Promise.all([
        loadImage('/assets/portrait-natural/base.png'),loadImage('/assets/portrait-natural/eyelids.png'),loadImage('/assets/portrait-natural/underpaint.png')]);
      const size=256,rig=new PortraitRig(open,closed,size,underpaint),canvas=document.createElement('canvas');
      canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
      if(!ctx)throw Error('Canvas 2D unavailable in source probe');
      if(!(rig.groups instanceof Int8Array)||!(rig.weights instanceof Float32Array)||
        !(rig.protectedPixels instanceof Uint8Array)||
        [rig.groups,rig.weights,rig.protectedPixels].some(x=>x.length!==size*size))
        throw Error('Invalid rig influence/protection maps');
      const table=createMotionTable({direction:1,gust:.35,stiffness:18,damping:5});
      const render=(t,gain=1,eye=1)=>{
        rig.paint(ctx,table,t,gain,eye);
        return new Uint32Array(ctx.getImageData(0,0,size,size).data.buffer);
      };
      const equal=(a,b)=>a.every((v,i)=>v===b[i]);
      const timeline=(t)=>{const s=samplePortrait(t,1);return render(s.timeMs,1,s.eyeOpen)};
      const rest=render(0),gust=render(1020),eyeOpen=render(740),blink=render(740,1,0);
      const final=render(1890),wrap=render(LOOP_MS),zero=render(1020,0);
      // Inspect every reference phase with open eyes, isolating wind from the blink.
      const phases=KEY_TIMES.map(t=>render(t));
      const active=Array.from({length:10},()=>new Set()),counts=Array(10).fill(0);
      let protectedCount=0,protectedChanged=0,rootChanged=0,rootCount=0,blinkChanged=0,outsideEyes=0,windChanged=0,silhouetteChanged=0,unexpectedColor=0,interiorHoles=0;
      const colors=new Set(PALETTE.map(hex=>{const v=parseInt(hex.slice(1),16);return (0xff000000|(v&255)<<16|v&0xff00|v>>>16)>>>0}));
      let opaque=0,transparent=0,partialAlpha=0,topOpaque=0,bottomOpaque=0;
      const sourceCanvas=document.createElement('canvas');sourceCanvas.width=sourceCanvas.height=size;
      const sourceContext=sourceCanvas.getContext('2d',{willReadFrequently:true});
      sourceContext.drawImage(open,0,0);const source=sourceContext.getImageData(0,0,size,size).data;
      const closedCanvas=document.createElement('canvas');closedCanvas.width=closedCanvas.height=size;
      const closedContext=closedCanvas.getContext('2d',{willReadFrequently:true});
      closedContext.drawImage(closed,0,0);const closedSource=closedContext.getImageData(0,0,size,size).data;
      let sourcePartialAlpha=0;
      for(let i=0;i<rest.length;i++){
        const alpha=rest[i]>>>24;
        if(alpha===0)transparent++;else if(alpha===255)opaque++;
        if(alpha!==0&&alpha!==255)partialAlpha++;
        if(i<size&&alpha===255)topOpaque++;
        if(i>=rest.length-size&&alpha===255)bottomOpaque++;
        if((source[i*4+3]!==0&&source[i*4+3]!==255)||
          (closedSource[i*4+3]!==0&&closedSource[i*4+3]!==255))sourcePartialAlpha++;
        if(rest[i]!==gust[i]){windChanged++;if(rig.groups[i]>=0)counts[rig.groups[i]]++;}
        if(rig.protectedPixels[i])protectedCount++;
        if(rig.rootPixels[i])rootCount++;
        if((rest[i]>>>24)!==(gust[i]>>>24))silhouetteChanged++;
        if(phases.some(frame=>frame[i]!==rest[i])){
          if(rig.protectedPixels[i])protectedChanged++;
          if(rig.rootPixels[i])rootChanged++;
          if(rig.groups[i]>=0)active[rig.groups[i]].add(i);
        }
        if(eyeOpen[i]!==blink[i]){
          blinkChanged++;
          const x=(i%size+.5)*256/size,y=(Math.floor(i/size)+.5)*256/size;
          if(!EYES.some(eye=>inside(x,y,eye.polygon)))outsideEyes++;
        }
        for(const frame of phases){const a=frame[i]>>>24;if(a!==0&&a!==255)partialAlpha++;if(a!==0&&!colors.has(frame[i]))unexpectedColor++;}
      }
      // These lie in the former navy background, outside the deliberately cropped close-up.
      const backgroundPoints=[[248,8],[248,32],[248,64],[8,96],[8,128]];
      const backgroundAlpha=backgroundPoints.map(([x,y])=>rest[y*size+x]>>>24);
      const repair=document.createElement('canvas');repair.width=repair.height=size;
      const repairContext=repair.getContext('2d',{willReadFrequently:true});repairContext.drawImage(underpaint,0,0);
      const repairPixels=new Uint32Array(repairContext.getImageData(0,0,size,size).data.buffer);
      let revealedUnderpaint=0;
      for(let i=0;i<rest.length;i++){
        if(rig.groups[i]>=0&&rig.groups[i]<8&&gust[i]===repairPixels[i]&&gust[i]!==rest[i])revealedUnderpaint++;
        if((rest[i]>>>24)===255&&(repairPixels[i]>>>24)===255&&(gust[i]>>>24)===0)interiorHoles++;
      }
      const windOnlyPhases=[230,460,630,740,850,1020,1300,1570].map(t=>({time:t,changed:render(t).reduce((n,v,i)=>n+(v!==rest[i]),0)}));
      const peakOffsets=Array(10).fill(0);
      for(const t of [230,460,630,740,850,1020,1150,1300,1450,1570]){
        render(t);
        for(const layer of rig.layers){
          const g=layer.group,r=HAIR_REGIONS[g];
          for(const i of layer.pixels){
            const u=Math.max(0,Math.min(8,(Math.floor(i/size)*256/size-r.root)/(r.end-r.root)*8));
            const a=g*9+Math.floor(u),b=g*9+Math.min(8,Math.floor(u)+1),mix=u-Math.floor(u);
            const dx=(rig.offsetsX[a]+(rig.offsetsX[b]-rig.offsetsX[a])*mix)*layer.field[i];
            const dy=(rig.offsetsY[a]+(rig.offsetsY[b]-rig.offsetsY[a])*mix)*layer.field[i];
            peakOffsets[g]=Math.max(peakOffsets[g],Math.hypot(dx,dy));
          }
        }
        for(let i=0;i<rig.groups.length;i++){const g=rig.groups[i];if(g>=8)peakOffsets[g]=Math.max(peakOffsets[g],Math.abs(rig.offsetsX[g*9]*rig.weights[i]));}
      }
      const loopTimes=[0,230,460,630,685,740,795,850,1020,1300,1570,1890,2299];
      const baseline=loopTimes.map(t=>timeline(t));
      let repeatedLoops=0;
      for(let cycle=1;cycle<=100;cycle++){
        if(!loopTimes.every((t,index)=>equal(baseline[index],timeline(t+cycle*LOOP_MS))))break;
        repeatedLoops++;
      }
      return {sourceSize:[open.naturalWidth,open.naturalHeight],canvasSize:[canvas.width,canvas.height],
        hairIds:HAIR_REGIONS.map(x=>x.id),windChanged,counts,activeGroupPixels:active.map(s=>s.size),
        protectedChanged,protectedCount,rootChanged,rootCount,blinkChanged,outsideEyes,silhouetteChanged,unexpectedColor,interiorHoles,revealedUnderpaint,windOnlyPhases,peakOffsets,
        alpha:{opaque,transparent,partialAlpha,sourcePartialAlpha,backgroundPoints,backgroundAlpha,topOpaque,bottomOpaque},
        repeatedLoops,phasesPerRepeatedLoop:loopTimes.length,
        finalEqualsRest:equal(rest,final),wrapEqualsRest:equal(rest,wrap),zeroWindEqualsRest:equal(rest,zero)};
    }""")
    results['rig'] = metrics
    ok('wind_moves_real_pixels', metrics['windChanged'] > 3500, metrics['windChanged'])
    ok('fixed_face_skin_necklace', metrics['protectedCount'] > 0 and metrics['protectedChanged'] == 0, metrics['protectedCount'])
    ok('roots_fixed', metrics['rootChanged'] == 0 and metrics['rootCount']>0)
    ok('blink_only_local_eyes', metrics['blinkChanged'] > 0 and metrics['outsideEyes'] == 0, metrics['blinkChanged'])
    ok('seam_and_settled_rest', metrics['finalEqualsRest'] and metrics['wrapEqualsRest'])
    ok('zero_wind_static_hair_ears', metrics['zeroWindEqualsRest'])
    ok('earring_pixels_move', all(c>0 for c in metrics['activeGroupPixels'][8:]), metrics['activeGroupPixels'][8:])
    ok('independent_hair_groups_move', len(set(metrics['hairIds'])) == 8 and all(c > 0 for c in metrics['activeGroupPixels'][:8]), metrics['activeGroupPixels'])
    ok('visible_hair_silhouette_changes',metrics['silhouetteChanged']>=100,metrics['silhouetteChanged'])
    ok('foreground_curls_move_in_screen_pixels',all(metrics['peakOffsets'][g]>=6 for g in [6,7]),metrics['peakOffsets'])
    ok('wind_is_visible_before_during_and_after_blink',all(x['changed']>400 for x in metrics['windOnlyPhases'][1:]),metrics['windOnlyPhases'])
    ok('vacated_hair_uses_repair_plate',metrics['revealedUnderpaint']>50,metrics['revealedUnderpaint'])
    ok('no_holes_in_opaque_underpaint',metrics['interiorHoles']==0,metrics['interiorHoles'])
    ok('all_motion_keeps_the_fixed_pixel_palette',metrics['unexpectedColor']==0,metrics['unexpectedColor'])
    ok('square_original_closeup', metrics['sourceSize'] == [256,256] and metrics['canvasSize'] == [256,256])
    alpha = metrics['alpha']
    ok('binary_alpha_source_and_animation', alpha['partialAlpha'] == 0 and alpha['sourcePartialAlpha'] == 0, alpha)
    ok('former_navy_background_transparent', alpha['transparent'] > 1000 and all(a == 0 for a in alpha['backgroundAlpha']), alpha['backgroundAlpha'])
    ok('opaque_character_original_crop', alpha['opaque'] > 1000 and alpha['topOpaque'] > 0 and alpha['bottomOpaque'] > 0)
    ok('one_hundred_loops_exact_same_pixels', metrics['repeatedLoops'] == 100, {'loops': metrics['repeatedLoops'], 'phasesPerLoop': metrics['phasesPerRepeatedLoop']})
    page.goto(portrait_url(ROOT + '?debug=1'))
    page.wait_for_selector('canvas[data-ready=true]')
    before = page.locator('.hud').inner_text()
    page.wait_for_timeout(300)
    ok('live_timeline_progresses', before != page.locator('.hud').inner_text())
    ok('live_playback_semantic_state', page.locator('canvas').get_attribute('data-playback') == 'looping')
    page.locator('summary').click()
    ok('hidden_debug_panel_opens', page.locator('input[type=range]').count() == 6)
    ok('debug_sliders_labelled', page.locator('input[type=range]').evaluate_all('(xs)=>xs.every(x=>x.closest("label"))'))
    before_pause = int(re.search(r'\d+', page.locator('.hud dd').first.inner_text()).group())
    page.get_by_role('button', name='暫停', exact=True).click()
    page.wait_for_selector('canvas[data-ready=true]')
    page.wait_for_timeout(200)
    frozen = page.locator('canvas').evaluate('(c)=>c.toDataURL()')
    paused_time = page.locator('.hud dd').first.inner_text()
    page.wait_for_timeout(200)
    ok('pause_preserves_current_pose', before_pause > 0 and int(re.search(r'\d+', paused_time).group()) >= before_pause and paused_time == page.locator('.hud dd').first.inner_text())
    ok('pause_stable', frozen == page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
    ok('paused_playback_semantic_state', page.locator('canvas').get_attribute('data-playback') == 'static')
    page.get_by_role('button', name='眨眼', exact=True).click()
    page.wait_for_timeout(100)
    closed = page.locator('canvas').evaluate('(c)=>c.toDataURL()')
    page.wait_for_timeout(220)
    ok('manual_blink_local_and_restores', closed != frozen and frozen == page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
    page.get_by_role('button', name='繼續', exact=True).click()
    page.wait_for_selector('canvas[data-ready=true]')
    page.wait_for_timeout(250)
    ok('resume_advances', paused_time != page.locator('.hud dd').first.inner_text() and page.locator('canvas').get_attribute('data-playback') == 'looping')
    reduced = b.new_context(viewport={'width': 1200, 'height': 1000}, reduced_motion='reduce')
    reduced.add_init_script('window.__raf=0;const r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=(cb)=>{window.__raf++;return r(cb)}')
    rp = reduced.new_page()
    rp.goto(portrait_url(ROOT))
    rp.wait_for_selector('canvas[data-ready=true]')
    rp.wait_for_timeout(150)
    reduced_start = rp.locator('canvas').evaluate('(c)=>c.toDataURL()')
    rp.wait_for_timeout(200)
    ok('initial_reduced_motion_static', reduced_start == rp.locator('canvas').evaluate('(c)=>c.toDataURL()'))
    ok('reduced_playback_semantic_state', rp.locator('canvas').get_attribute('data-playback') == 'static')
    ok('initial_reduced_motion_zero_raf', rp.evaluate('window.__raf') == 0, rp.evaluate('window.__raf'))
    rp.emulate_media(reduced_motion='no-preference')
    rp.wait_for_timeout(500)
    ok('live_reduced_motion_resume', rp.locator('canvas').evaluate('(c)=>c.toDataURL()') != reduced_start)
    rp.emulate_media(reduced_motion='reduce')
    rp.wait_for_timeout(50)
    after = rp.locator('canvas').evaluate('(c)=>c.toDataURL()')
    rp.wait_for_timeout(150)
    ok('live_reduced_motion_stop', after == rp.locator('canvas').evaluate('(c)=>c.toDataURL()') and after == reduced_start)
    reduced.close()
    page.goto(portrait_url(ROOT + '?t=740'))
    page.wait_for_selector('canvas[data-ready=true]')
    seek = page.locator('canvas').evaluate('(c)=>c.toDataURL()')
    page.wait_for_timeout(120)
    ok('seek_static', seek == page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
    ok('seek_playback_semantic_state', page.locator('canvas').get_attribute('data-playback') == 'static')
    lifecycle = page.evaluate("async()=>{\n const {PortraitPlayer}=await import('/src/animation/portraitPlayer.ts');const{readStageOptions}=await import('/src/animation/stageOptions.ts');\n const c=document.createElement('canvas');document.body.append(c);let count=0;const player=new PortraitPlayer(c,readStageOptions(''),()=>{count++});\n await new Promise(r=>setTimeout(r,500));const running=count;\n Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));\n await new Promise(r=>setTimeout(r,250));const hidden=count;\n Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));\n await new Promise(r=>setTimeout(r,300));const resumed=count;\n player.destroy();const stopped=count;await new Promise(r=>setTimeout(r,250));const destroyed=count;c.remove();delete document.hidden;\n return{running,hidden,resumed,stopped,destroyed};\n}")
    ok('hidden_resume_destroy_lifecycle', lifecycle['running'] > 0 and lifecycle['hidden'] == lifecycle['running'] and (lifecycle['resumed'] > lifecycle['hidden']) and (lifecycle['destroyed'] == lifecycle['stopped']), lifecycle)
    refresh = page.evaluate("async()=>{\n const{PortraitPlayer}=await import('/src/animation/portraitPlayer.ts');const{readStageOptions}=await import('/src/animation/stageOptions.ts');\n const originalRAF=window.requestAnimationFrame,originalCancel=window.cancelAnimationFrame;\n const run=async(hz)=>{let id=0;const queue=new Map();window.requestAnimationFrame=cb=>{queue.set(++id,cb);return id};window.cancelAnimationFrame=id=>queue.delete(id);\n const c=document.createElement('canvas'),player=new PortraitPlayer(c,readStageOptions(''));\n try{for(let i=0;c.dataset.ready!=='true'&&i<500;i++)await new Promise(r=>setTimeout(r,10));if(c.dataset.ready!=='true')throw Error('player load timeout');\n for(let frame=0;frame<=hz;frame++){const callbacks=[...queue.values()];queue.clear();callbacks.forEach(cb=>cb(1000+frame*1000/hz))}\n return{elapsed:player.elapsed,pixels:c.toDataURL()};}finally{player.destroy();}};\n try{const a=await run(60),b=await run(120);return{elapsed60:a.elapsed,elapsed120:b.elapsed,identical:a.pixels===b.pixels};}\n finally{window.requestAnimationFrame=originalRAF;window.cancelAnimationFrame=originalCancel;}\n }")
    ok('refresh_60_120_same_speed_and_pixels', abs(refresh['elapsed60'] - 1000) < 0.001 and abs(refresh['elapsed120'] - 1000) < 0.001 and refresh['identical'], refresh)
    for style in ['voxel', 'legacy']:
        page.goto(portrait_url(ROOT + f'?style={style}&pose=5'))
        page.wait_for_timeout(600)
        ok('archive_' + style, page.locator('canvas').get_attribute('data-style') == style and page.locator('canvas').evaluate('(c)=>c.getContext("2d").getImageData(100,100,1,1).data[3]') > 0)
    mobile = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    mobile.goto(portrait_url(ROOT + '?t=1020'))
    mobile.wait_for_selector('canvas[data-ready=true]')
    box = mobile.locator('.stage').bounding_box()
    ok('mobile_complete_no_overflow', mobile.evaluate('document.documentElement.scrollWidth<=innerWidth') and box['x'] >= 0 and (box['y'] >= 0) and (box['x'] + box['width'] <= 390) and (box['y'] + box['height'] <= 844), box)
    mobile.screenshot(path=str(OUT / 'mobile-final.png'))
    mobile.close()
    ok('no_browser_errors', not results['errors'], results['errors'])
    b.close()
results['status'] = 'passed'
save_results()
print(json.dumps(results, ensure_ascii=False))
