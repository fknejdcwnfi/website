#!/usr/bin/env python3
"""Capture actual circular source/snow animation, or measure isolated native cadence."""
import argparse
import hashlib
import json
from pathlib import Path
import statistics
import subprocess
import tempfile
from playwright.sync_api import sync_playwright
from capture_portrait import CONTROLLED_RAF

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:5180/website/')
parser.add_argument('--output',type=Path,default=ROOT/'artifacts/poetic-pixel')
parser.add_argument('--measure',action='store_true')
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    if args.measure:
        page.add_init_script('''
          window.__measure={active:false,cost:[],times:[],frames:[],previewDecodedMs:null};
          const observer=new MutationObserver(()=>{
            const v=document.getElementById('vermouth-poetic-bootstrap');
            if(v&&!v.__tracked){v.__tracked=true;v.requestVideoFrameCallback?.(()=>{__measure.previewDecodedMs??=performance.now()})}
          });observer.observe(document,{childList:true,subtree:true});
          const raf=requestAnimationFrame;
          window.requestAnimationFrame=fn=>raf.call(window,t=>{
            const start=performance.now();fn(t);
            if(__measure.active){__measure.cost.push(performance.now()-start);__measure.times.push(t);
              __measure.frames.push(document.querySelector('.reference-scene__canvas')?.dataset.sourceFrame)}
          });
        ''')
    else:
        page.add_init_script(CONTROLLED_RAF)
    page.goto(args.url)
    page.wait_for_selector('.reference-scene__canvas[data-ready=true][data-playback=looping]')
    page.evaluate('document.fonts.ready')
    if args.measure:
        ready=page.evaluate('performance.now()');page.wait_for_timeout(2000)
        result=page.evaluate('''async()=>{__measure.active=true;const s=performance.now();
          await new Promise(r=>setTimeout(r,12000));__measure.active=false;
          return {...__measure,seconds:(performance.now()-s)/1000}}''')
        costs=sorted(result['cost']);changes=sum(a!=b for a,b in zip(result['frames'],result['frames'][1:]))
        report={'conditions':'Fresh single production Chromium1440x1100/DPR1;2s settle;12s native rAF; no screenshots or concurrent browsers',
                'firstDecodedPreviewMsLocal':result['previewDecodedMs'],'hdReadyMsLocal':ready,
                'callbacks':len(costs),'seconds':result['seconds'],'callbacksPerSecond':len(costs)/result['seconds'],
                'estimatedSourceFrameChanges':changes,'estimatedSourceChangesPerSecond':changes/result['seconds'],
                'originalSourceFps':12.5,'estimatedPlaybackFps':50,'snowParticles':288,
                'callbackMs':{'median':statistics.median(costs),'p95':costs[int((len(costs)-1)*.95)],'max':max(costs)},
                'browserErrors':errors,'physicalDisplayVerified':False}
        (args.output/'performance.json').write_text(json.dumps(report,indent=2)+'\n')
    else:
        output=args.output/'preview';output.mkdir(exist_ok=True)
        page.evaluate('window.__captureStep(0)')
        start=page.locator('.reference-scene__canvas').evaluate('c=>({...c.dataset})')
        clip=page.locator('.reference-scene__viewport').bounding_box()
        with tempfile.TemporaryDirectory(prefix='poetic-circle-') as temporary:
            for index in range(384):
                page.evaluate('t=>window.__captureStep(t)',index*1000/60)
                page.screenshot(path=str(Path(temporary)/f'{index:03}.png'),clip=clip,animations='disabled')
                if index in (0,60,120,240,383):
                    page.screenshot(path=str(output/f'time-{round(index*1000/60)}.png'),clip=clip,animations='disabled')
                if index%120==0:print(f'captured {index}/384',flush=True)
            browser.close()
            movie=output/'animation.mp4'
            subprocess.run(['ffmpeg','-y','-v','error','-framerate','60','-i',str(Path(temporary)/'%03d.png'),
                            '-r','60','-fps_mode','cfr','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:color=white',
                            '-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
        report={'source':'Actual CSS circle screenshots with controlled rAF;50fps source estimates and independent snow',
                'frames':384,'encodingFps':60,'durationMs':6400,'initialSceneState':start,'clip':clip,
                'bytes':movie.stat().st_size,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),
                'browserErrors':errors,'physicalDisplayVerified':False}
        (output/'capture.json').write_text(json.dumps(report,indent=2)+'\n')
    browser.close()
assert not errors,errors
print(json.dumps(report))
