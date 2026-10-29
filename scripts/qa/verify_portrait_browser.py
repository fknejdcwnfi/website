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
parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[2] / 'artifacts/flowing-hair/qa.json')
args = parser.parse_args()
ROOT = args.url.rstrip('/') + '/'
OUT = Path('/tmp/flowing-hair-qa')
OUT.mkdir(exist_ok=True)
EVIDENCE = args.output
results = {'url': args.url, 'contract': 'visible circle-interior flowing hair on continuous12s wind; unchanged independent24s blinks; fixed face and sharp binary pixels', 'status': 'failed', 'checks': [], 'errors': []}

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
    page.goto(portrait_url(ROOT + '?pose=1'))
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
      const {PortraitRig,HAIR_REGIONS,EYES,inside,CHAIN_STATIONS}=await import('/src/features/portrait/renderer/portraitRig.ts');
      const {loadImage,PALETTE}=await import('/src/features/portrait/renderer/portraitAsset.ts');
      const {createMotionTable,samplePortrait,sampleBlink,KEY_TIMES,LOOP_MS,BLINK_CYCLE_MS,BLINK_STARTS,BLINK_DURATION_MS}=await import('/src/features/portrait/animation/portraitTimeline.ts');
      const [open,closed,underpaint]=await Promise.all([
        loadImage('/assets/portrait-natural/base.png'),loadImage('/assets/portrait-natural/eyelids.png'),loadImage('/assets/portrait-natural/underpaint.png')]);
      const size=256,rig=new PortraitRig(open,closed,size,underpaint),canvas=document.createElement('canvas');
      canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
      if(!ctx)throw Error('Canvas2D unavailable in source probe');
      if(!(rig.groups instanceof Int8Array)||!(rig.weights instanceof Float32Array)||!(rig.protectedPixels instanceof Uint8Array)||
        [rig.groups,rig.weights,rig.protectedPixels].some(x=>x.length!==size*size))throw Error('Invalid influence/protection maps');
      const table=createMotionTable({direction:1,gust:.35,stiffness:18,damping:5});
      const render=(t,gain=1,eye=1)=>{rig.paint(ctx,table,t,gain,eye);return new Uint32Array(ctx.getImageData(0,0,size,size).data.buffer)};
      const equal=(a,b)=>a.every((value,index)=>value===b[index]);
      const difference=(a,b)=>a.reduce((n,value,index)=>n+(value!==b[index]),0);
      const rest=render(0,0),breeze=render(6000),normalStart=render(0),eyeOpen=render(4500),blink=render(4500,1,0);
      // Every half-second window must have real hair/jewelry changes. Integer
      // pixel art may legitimately hold the same pixels for adjacent RAFs.
      const phases=Array.from({length:24},(_,index)=>render(index*500));
      const windows=phases.map((frame,index)=>({start:index*500,end:(index+1)*500,changed:difference(frame,phases[(index+1)%phases.length])}));
      const active=Array.from({length:10},()=>new Set()),counts=Array(10).fill(0);
      let protectedCount=0,protectedChanged=0,rootChanged=0,rootCount=0,blinkChanged=0,outsideEyes=0,windChanged=0,silhouetteChanged=0,unexpectedColor=0,interiorHoles=0;
      const colors=new Set(PALETTE.map(hex=>{const value=parseInt(hex.slice(1),16);return (0xff000000|(value&255)<<16|value&0xff00|value>>>16)>>>0}));
      let opaque=0,transparent=0,partialAlpha=0,topOpaque=0,bottomOpaque=0;
      const pixels=image=>{const c=document.createElement('canvas');c.width=c.height=size;const context=c.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=false;context.drawImage(image,0,0);return new Uint32Array(context.getImageData(0,0,size,size).data.buffer)};
      const source=pixels(open),closedSource=pixels(closed),repairPixels=pixels(underpaint);
      let sourcePartialAlpha=0,revealedUnderpaint=0;
      for(let index=0;index<rest.length;index++){
        const alpha=rest[index]>>>24;
        if(alpha===0)transparent++;else if(alpha===255)opaque++;else partialAlpha++;
        if(index<size&&alpha===255)topOpaque++;
        if(index>=rest.length-size&&alpha===255)bottomOpaque++;
        if(![0,255].includes(source[index]>>>24)||![0,255].includes(closedSource[index]>>>24))sourcePartialAlpha++;
        if(rest[index]!==breeze[index]){windChanged++;if(rig.groups[index]>=0)counts[rig.groups[index]]++;}
        if(rig.protectedPixels[index])protectedCount++;
        if(rig.rootPixels[index])rootCount++;
        if((rest[index]>>>24)!==(breeze[index]>>>24))silhouetteChanged++;
        if(phases.some(frame=>frame[index]!==rest[index])){
          if(rig.protectedPixels[index])protectedChanged++;
          if(rig.rootPixels[index])rootChanged++;
          if(rig.groups[index]>=0)active[rig.groups[index]].add(index);
        }
        if(eyeOpen[index]!==blink[index]){
          blinkChanged++;
          const x=(index%size+.5)*256/size,y=(Math.floor(index/size)+.5)*256/size;
          if(!EYES.some(eye=>inside(x,y,eye.polygon)))outsideEyes++;
        }
        if(rig.groups[index]>=0&&rig.groups[index]<8&&breeze[index]===repairPixels[index]&&breeze[index]!==rest[index])revealedUnderpaint++;
        if((rest[index]>>>24)===255&&(repairPixels[index]>>>24)===255&&phases.some(frame=>(frame[index]>>>24)===0))interiorHoles++;
        for(const frame of phases){const alpha=frame[index]>>>24;if(alpha!==0&&alpha!==255)partialAlpha++;if(alpha!==0&&!colors.has(frame[index]))unexpectedColor++;}
      }
      const circleMask=Array.from({length:size*size},(_,index)=>{
        const x=index%size+.5,y=Math.floor(index/size)+.5;
        return (x-128)**2+(y-128)**2<128**2&&!EYES.some(eye=>inside(x,y,eye.polygon));
      });
      const circleDifference=(a,b)=>a.reduce((count,value,index)=>count+(circleMask[index]&&value!==b[index]),0);
      const circleWindows=phases.map((frame,index)=>({start:index*500,changed500ms:circleDifference(frame,phases[(index+1)%phases.length]),changed2000ms:circleDifference(frame,phases[(index+4)%phases.length])}));
      const peakOffsets=Array(10).fill(0),circlePeakOffsets=Array(10).fill(0),circleMidsectionPeakOffsets=Array(10).fill(0);
      const circleActive=Array.from({length:10},()=>new Set());
      for(let phase=0;phase<phases.length;phase++)for(let index=0;index<size*size;index++){
        if(circleMask[index]&&phases[phase][index]!==phases[(phase+4)%phases.length][index]&&rig.groups[index]>=0)circleActive[rig.groups[index]].add(index);
      }
      for(let time=0;time<LOOP_MS;time+=250){
        render(time);
        for(const layer of rig.layers)for(const index of layer.pixels){
          const y=Math.floor(index/size),distance=Math.hypot(layer.rowX[y]*layer.field[index],layer.rowY[y]*layer.field[index]);
          peakOffsets[layer.group]=Math.max(peakOffsets[layer.group],distance);
          if(circleMask[index]){
            circlePeakOffsets[layer.group]=Math.max(circlePeakOffsets[layer.group],distance);
            if(y<220)circleMidsectionPeakOffsets[layer.group]=Math.max(circleMidsectionPeakOffsets[layer.group],distance);
          }
        }
        for(const index of rig.jewelryPixels){const group=rig.groups[index];peakOffsets[group]=Math.max(peakOffsets[group],Math.abs(rig.offsetsX[group*CHAIN_STATIONS]*rig.weights[index]));}
      }
      const offsets=time=>{render(time);return [...rig.offsetsX,...rig.offsetsY]};
      const minus=offsets(-1),center=offsets(0),plus=offsets(1);
      const seam={max_offset_delta:Math.max(...plus.map((value,index)=>Math.abs(value-minus[index]))),max_velocity_difference:Math.max(...center.map((value,index)=>Math.abs((plus[index]-value)-(value-minus[index]))))};
      const rasterPhases=[-1000/60,-1000/120,0,1000/120,1000/60].map(time=>render(time));
      seam.raster_differences=rasterPhases.slice(1).map((frame,index)=>difference(frame,rasterPhases[index]));
      const silhouettePeak=Math.max(...phases.map(frame=>frame.reduce((count,value,index)=>count+((value>>>24)!==(rest[index]>>>24)),0)));
      const loopTimes=[0,500,1200,2400,3600,4400,4500,4680,6000,8400,9600,11300,11999];
      const baseline=loopTimes.map(time=>render(time));let repeatedLoops=0;
      for(let cycle=1;cycle<=100;cycle++){
        if(!loopTimes.every((time,index)=>equal(baseline[index],render(time+cycle*LOOP_MS))))break;
        repeatedLoops++;
      }
      const blinkSchedule=BLINK_STARTS.map((start,index)=>({start_ms:start,closed_ms:start+100,end_ms:start+BLINK_DURATION_MS,
        next_start_gap_ms:(BLINK_STARTS[index+1]??BLINK_STARTS[0]+BLINK_CYCLE_MS)-start,
        same_wind_phase_later:sampleBlink(start+100+LOOP_MS),closed:sampleBlink(start+100),
        wind_during_blink:difference(render(start),render(start+BLINK_DURATION_MS))}));
      const blinkRepeat=Array.from({length:BLINK_CYCLE_MS/10},(_,index)=>index*10).every(time=>sampleBlink(time)===sampleBlink(time+BLINK_CYCLE_MS));
      const backgroundPoints=[[248,8],[248,32],[248,64],[8,96],[8,128]];
      return {sourceSize:[open.naturalWidth,open.naturalHeight],canvasSize:[canvas.width,canvas.height],windLoopMs:LOOP_MS,blinkCycleMs:BLINK_CYCLE_MS,
        chainStations:CHAIN_STATIONS,hairIds:HAIR_REGIONS.map(region=>region.id),windChanged,counts,activeGroupPixels:active.map(set=>set.size),
        protectedChanged,protectedCount,rootChanged,rootCount,blinkChanged,outsideEyes,silhouetteChanged,silhouettePeak,unexpectedColor,interiorHoles,revealedUnderpaint,peakOffsets,
        continuousWindows:windows,circleWindows,circlePeakOffsets,circleMidsectionPeakOffsets,circleActiveGroupPixels:circleActive.map(set=>set.size),seam,blinkSchedule,blinkRepeat,
        alpha:{opaque,transparent,partialAlpha,sourcePartialAlpha,backgroundPoints,backgroundAlpha:backgroundPoints.map(([x,y])=>rest[y*size+x]>>>24),topOpaque,bottomOpaque},
        repeatedLoops,phasesPerRepeatedLoop:loopTimes.length,normalStartIsMoving:!equal(rest,normalStart),
        wrapEqualsStart:equal(normalStart,render(LOOP_MS)),zeroWindEqualsRest:equal(rest,render(6000,0)),canonicalRestEqualsSource:equal(rest,source)};
    }""")
    results['rig'] = metrics
    ok('wind_moves_real_pixels', metrics['windChanged'] > 500, metrics['windChanged'])
    ok('fixed_face_skin_necklace', metrics['protectedCount'] > 0 and metrics['protectedChanged'] == 0, metrics['protectedCount'])
    ok('roots_fixed', metrics['rootChanged'] == 0 and metrics['rootCount'] > 0)
    ok('blink_only_local_eyes', metrics['blinkChanged'] > 0 and metrics['outsideEyes'] == 0, metrics['blinkChanged'])
    ok('gentle_twelve_second_wind_and_independent_blink_clock',metrics['windLoopMs']==12000 and metrics['blinkCycleMs']==24000)
    ok('normal_start_does_not_force_a_static_pose', metrics['normalStartIsMoving'] and metrics['wrapEqualsStart'])
    ok('zero_wind_returns_exact_canonical_rest', metrics['zeroWindEqualsRest'] and metrics['canonicalRestEqualsSource'])
    ok('every_half_second_window_has_wind_pixel_changes', all(window['changed']>0 for window in metrics['continuousWindows']), metrics['continuousWindows'])
    ok('rig_delay_and_recoil_continuous_at_wind_seam', metrics['seam']['max_offset_delta']<.01 and metrics['seam']['max_velocity_difference']<.0001,metrics['seam'])
    seam_diff=metrics['seam']['raster_differences']
    ok('actual_pixel_seam_has_no_reset_jump',max(seam_diff[1:3])<=max(seam_diff[0],seam_diff[3])*2+16,seam_diff)
    ok('independent_occasional_blinks_and_continuing_hair',metrics['blinkRepeat'] and all(event['closed']==0 and event['same_wind_phase_later']==1 and event['wind_during_blink']>0 for event in metrics['blinkSchedule']),metrics['blinkSchedule'])
    ok('earring_pixels_move', all(count>0 for count in metrics['activeGroupPixels'][8:]),metrics['activeGroupPixels'][8:])
    ok('independent_hair_groups_move',len(set(metrics['hairIds']))==8 and all(count>0 for count in metrics['activeGroupPixels'][:8]),metrics['activeGroupPixels'])
    ok('visible_but_restrained_foreground_curls',all(1<=metrics['peakOffsets'][group]<=18 for group in [6,7]),metrics['peakOffsets'])
    ok('circle_interior_hair_moves_in_every_half_second',all(window['changed500ms']>0 and window['changed2000ms']>0 for window in metrics['circleWindows']),metrics['circleWindows'])
    ok('circle_hair_midsections_move_not_just_cropped_tips',all(metrics['circleMidsectionPeakOffsets'][group]>=2 for group in [4,5,6,7]),metrics['circleMidsectionPeakOffsets'])
    ok('circle_visible_hair_layers_participate',all(count>0 for count in metrics['circleActiveGroupPixels'][:8]),metrics['circleActiveGroupPixels'])
    ok('visible_hair_silhouette_changes',metrics['silhouettePeak']>20,{'phase6000':metrics['silhouetteChanged'],'whole_cycle_peak':metrics['silhouettePeak']})
    ok('vacated_hair_uses_repair_plate',metrics['revealedUnderpaint']>20,metrics['revealedUnderpaint'])
    ok('no_holes_in_opaque_underpaint',metrics['interiorHoles']==0,metrics['interiorHoles'])
    ok('all_motion_keeps_the_fixed_pixel_palette',metrics['unexpectedColor']==0,metrics['unexpectedColor'])
    ok('square_original_logical_closeup',metrics['sourceSize']==[256,256] and metrics['canvasSize']==[256,256])
    alpha=metrics['alpha']
    ok('binary_alpha_source_and_animation',alpha['partialAlpha']==0 and alpha['sourcePartialAlpha']==0,alpha)
    ok('former_navy_background_transparent',alpha['transparent']>1000 and all(value==0 for value in alpha['backgroundAlpha']),alpha['backgroundAlpha'])
    ok('opaque_character_original_crop',alpha['opaque']>1000 and alpha['topOpaque']>0 and alpha['bottomOpaque']>0)
    ok('one_hundred_wind_loops_exact_same_pixels',metrics['repeatedLoops']==100,{'loops':metrics['repeatedLoops'],'phasesPerLoop':metrics['phasesPerRepeatedLoop']})
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
    reduced_raf_start = rp.evaluate('window.__raf')
    rp.wait_for_timeout(200)
    ok('initial_reduced_motion_static', reduced_start == rp.locator('canvas').evaluate('(c)=>c.toDataURL()'))
    ok('reduced_playback_semantic_state', rp.locator('canvas').get_attribute('data-playback') == 'static')
    ok('reduced_motion_has_no_continuous_raf_after_layout',rp.evaluate('window.__raf') == reduced_raf_start,{'initial_layout_raf':reduced_raf_start,'after_static_wait':rp.evaluate('window.__raf')})
    rp.emulate_media(reduced_motion='no-preference')
    rp.wait_for_timeout(500)
    ok('live_reduced_motion_resume', rp.locator('canvas').evaluate('(c)=>c.toDataURL()') != reduced_start)
    rp.emulate_media(reduced_motion='reduce')
    rp.wait_for_timeout(50)
    after = rp.locator('canvas').evaluate('(c)=>c.toDataURL()')
    rp.wait_for_timeout(150)
    ok('live_reduced_motion_stop', after == rp.locator('canvas').evaluate('(c)=>c.toDataURL()') and after == reduced_start)
    reduced.close()
    page.goto(portrait_url(ROOT + '?t=4500'))
    page.wait_for_selector('canvas[data-ready=true]')
    seek = page.locator('canvas').evaluate('(c)=>c.toDataURL()')
    page.wait_for_timeout(120)
    ok('seek_static', seek == page.locator('canvas').evaluate('(c)=>c.toDataURL()'))
    ok('seek_playback_semantic_state', page.locator('canvas').get_attribute('data-playback') == 'static')
    lifecycle = page.evaluate("async()=>{\n const {PortraitPlayer}=await import('/src/features/portrait/animation/portraitPlayer.ts');const{readStageOptions}=await import('/src/features/portrait/animation/stageOptions.ts');\n const c=document.createElement('canvas');document.body.append(c);let count=0;const player=new PortraitPlayer(c,readStageOptions(''),()=>{count++});\n await new Promise(r=>setTimeout(r,500));const running=count;\n Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));\n await new Promise(r=>setTimeout(r,250));const hidden=count;\n Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));\n await new Promise(r=>setTimeout(r,300));const resumed=count;\n player.destroy();const stopped=count;await new Promise(r=>setTimeout(r,250));const destroyed=count;c.remove();delete document.hidden;\n return{running,hidden,resumed,stopped,destroyed};\n}")
    ok('hidden_resume_destroy_lifecycle', lifecycle['running'] > 0 and lifecycle['hidden'] == lifecycle['running'] and (lifecycle['resumed'] > lifecycle['hidden']) and (lifecycle['destroyed'] == lifecycle['stopped']), lifecycle)
    # Exercise the real player with a controlled rAF scheduler. This checks elapsed
    # time and final pixels at each phase; it is not a physical display benchmark.
    refresh = page.evaluate(r"""async()=>{
      const {PortraitPlayer}=await import('/src/features/portrait/animation/portraitPlayer.ts');
      const {readStageOptions}=await import('/src/features/portrait/animation/stageOptions.ts');
      const nativeRAF=window.requestAnimationFrame,nativeCancel=window.cancelAnimationFrame;
      const startElapsed=20100;const checkpoints=[100,200,250,300,320,400,480,800,1200,3900,4000,4400,4680];const duration=4680;
      const run=async(hz)=>{
        let id=0;const queue=new Map();
        window.requestAnimationFrame=cb=>{queue.set(++id,cb);return id};
        window.cancelAnimationFrame=id=>queue.delete(id);
        const canvas=document.createElement('canvas'),player=new PortraitPlayer(canvas,readStageOptions(''));
        try{
          for(let i=0;canvas.dataset.ready!=='true'&&i<500;i++)await new Promise(r=>setTimeout(r,10));
          if(canvas.dataset.ready!=='true')throw Error('Player load timeout');
          player.elapsed=startElapsed;player.last=null;const times=new Set(checkpoints);
          for(let i=0;i<=Math.ceil(duration*hz/1000);i++){
            const t=i*1000/hz;if(t<duration)times.add(t);
          }
          const phases=[];let callbacksRun=0,maxQueued=0;
          for(const time of [...times].sort((a,b)=>a-b)){
            const callbacks=[...queue.values()];queue.clear();maxQueued=Math.max(maxQueued,callbacks.length);
            callbacks.forEach(cb=>{callbacksRun++;cb(1000+time)});
            if(checkpoints.includes(time))phases.push({time,elapsed:player.elapsed,pixels:canvas.toDataURL(),raw:new Uint32Array(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.buffer)});
          }
          return{hz,callbacksRun,maxQueued,phases};
        }finally{player.destroy()}
      };
      try{
        const runs=[];for(const hz of [60,120,144,240])runs.push(await run(hz));
        const baseline=runs[0];
        return{kind:'Simulated rAF timestamps, real PortraitPlayer and Canvas2D pixels; no physical high-refresh display claim',
          initial_elapsed_ms:startElapsed,checkpoint_ms:checkpoints,runs:runs.map(run=>({hz:run.hz,callbacksRun:run.callbacksRun,maxQueued:run.maxQueued,
            elapsed_ms:run.phases.map(phase=>phase.elapsed),
            phase_time_error_ms:run.phases.map(phase=>Math.abs(phase.elapsed-(startElapsed+phase.time))),
            pixel_changes_per_checkpoint:run.phases.map((phase,i)=>phase.raw.reduce((count,value,j)=>count+(value!==baseline.phases[i].raw[j]),0)),
            identical_pixels_at_all_checkpoints:run.phases.every((phase,i)=>phase.pixels===baseline.phases[i].pixels)}))};
      }finally{window.requestAnimationFrame=nativeRAF;window.cancelAnimationFrame=nativeCancel}
    }""")
    for run in refresh['runs']:
        ok(f"refresh_{run['hz']}_same_speed_and_pixels",
           max(run['phase_time_error_ms'])<.00001 and run['identical_pixels_at_all_checkpoints'] and run['maxQueued']==1,
           {key:value for key,value in run.items() if key!='elapsed_ms'})
    results['refresh_simulation']=refresh
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
