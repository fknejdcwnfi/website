#!/usr/bin/env python3
"""Encode actual source-timed CSS-circle samples, or measure native browser cadence."""
import argparse
import hashlib
import json
from pathlib import Path
import statistics
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
parser.add_argument('--output', type=Path, default=ROOT/'artifacts/faithful-pixel')
mode = parser.add_mutually_exclusive_group(required=True)
mode.add_argument('--encode-preview', action='store_true')
mode.add_argument('--measure', action='store_true')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

if args.encode_preview:
    frames = args.output/'site/circle-frames'
    inputs = [frames/f'frame_{index:02}.png' for index in range(16)]
    assert all(path.is_file() for path in inputs), 'Run verify_faithful_scene.py first.'
    output = args.output/'preview'
    output.mkdir(exist_ok=True)
    movie = output/'animation.mp4'
    with tempfile.TemporaryDirectory(prefix='faithful-circle-') as temporary:
        for index in range(64):
            (Path(temporary)/f'{index:03}.png').symlink_to(inputs[index % 16].resolve())
        subprocess.run(['ffmpeg','-y','-v','error','-framerate','25/2','-i',str(Path(temporary)/'%03d.png'),
                        '-r','50','-fps_mode','cfr','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:color=white',
                        '-c:v','libx264','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
    report = {'source':'Actual CSS circular viewport screenshots at each of the16 original80ms frames',
              'sourceFramesPerLoop':16,'frameDurationMs':80,'periodMs':1280,'loops':4,'durationMs':5120,
              'encodingFps':50,'interpolation':False,'encodingExplanation':'Each source frame repeated four times; no invented intermediate movement',
              'bytes':movie.stat().st_size,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),
              'physicalDisplayVerified':False}
    (output/'capture.json').write_text(json.dumps(report,indent=2)+'\n')
else:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
        errors = []
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.add_init_script('''
            window.__measure={active:false,cost:[],times:[],frames:[]};
            const raf=requestAnimationFrame;
            window.requestAnimationFrame=fn=>raf.call(window,t=>{
                const start=performance.now();fn(t);
                if(__measure.active){
                    __measure.cost.push(performance.now()-start);__measure.times.push(t);
                    __measure.frames.push(document.querySelector('.reference-scene__canvas')?.dataset.sourceFrame);
                }
            });
        ''')
        page.goto(args.url)
        page.wait_for_selector('.reference-scene__canvas[data-playback=looping][data-motion-kind=direct-source-frames]')
        ready = page.evaluate('performance.now()')
        page.wait_for_timeout(2000)
        result = page.evaluate('''async()=>{
            __measure.active=true;const start=performance.now();
            await new Promise(resolve=>setTimeout(resolve,12000));__measure.active=false;
            return {...__measure,seconds:(performance.now()-start)/1000};
        }''')
        costs = sorted(result['cost'])
        changes = sum(a != b for a,b in zip(result['frames'],result['frames'][1:]))
        report = {'conditions':'Fresh single production Chromium1440x1100/DPR1;2s settle;12s sample; native rAF; no screenshots or concurrent browsers',
                  'readyMsLocal':ready,'callbacks':len(costs),'seconds':result['seconds'],
                  'callbacksPerSecond':len(costs)/result['seconds'],'sourceFrameChanges':changes,
                  'sourceFrameChangesPerSecond':changes/result['seconds'],'originalSourceFps':12.5,
                  'callbackMs':{'median':statistics.median(costs),'p95':costs[int((len(costs)-1)*.95)],'max':max(costs)},
                  'browserErrors':errors,'physicalDisplayVerified':False}
        (args.output/'performance.json').write_text(json.dumps(report,indent=2)+'\n')
        browser.close()
        assert not errors, errors
print(json.dumps(report))
