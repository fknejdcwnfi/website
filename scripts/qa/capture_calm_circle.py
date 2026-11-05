#!/usr/bin/env python3
"""Capture the actual borderless calm circle with controlled rAF, or measure it natively."""
import argparse,hashlib,json,statistics,subprocess,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from capture_portrait import CONTROLLED_RAF
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',default='http://127.0.0.1:5180/website/')
p.add_argument('--output',type=Path,default=ROOT/'artifacts/calm-circle')
p.add_argument('--measure',action='store_true');args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 if args.measure:
  page.add_init_script('''window.__calm={active:false,cost:[],times:[]};const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>raf.call(window,t=>{const s=performance.now();fn(t);if(__calm.active){__calm.cost.push(performance.now()-s);__calm.times.push(t)}})''')
 else:page.add_init_script(CONTROLLED_RAF)
 page.goto(args.url);page.wait_for_selector('.reference-scene__canvas[data-playback=looping][data-motion-kind=local-rigid-locks]');page.evaluate('document.fonts.ready')
 if args.measure:
  ready=page.evaluate('performance.now()');page.wait_for_timeout(2000)
  result=page.evaluate('''async()=>{__calm.active=true;const s=performance.now();await new Promise(r=>setTimeout(r,12000));__calm.active=false;return{...__calm,seconds:(performance.now()-s)/1000}}''')
  costs=sorted(result['cost']);report={'conditions':'Fresh single production Chromium1440x1100/DPR1; native rAF;2s settle;12s sample; no screenshots or concurrent browser','readyMsLocal':ready,'paints':len(costs),'seconds':result['seconds'],'paintsPerSecond':len(costs)/result['seconds'],'callbackMs':{'median':statistics.median(costs),'p95':costs[int((len(costs)-1)*.95)],'max':max(costs)},'browserErrors':errors,'physicalDisplayVerified':False}
  (args.output/'performance.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));browser.close()
 else:
  page.evaluate('window.__captureStep(0)');element=page.locator('.reference-scene__viewport');clip=element.bounding_box();assert abs(clip['width']-clip['height'])<.01
  out=args.output/'preview';out.mkdir(exist_ok=True)
  with tempfile.TemporaryDirectory(prefix='calm-circle-')as temp:
   for index in range(720):
    page.evaluate('t=>window.__captureStep(t)',index*1000/60)
    page.screenshot(path=str(Path(temp)/f'{index:04d}.png'),clip=clip,animations='disabled')
    if index in [0,168,270,372,684]:page.screenshot(path=str(out/f'time-{index*1000//60}.png'),clip=clip,animations='disabled')
    if index%120==0:print(f'captured {index}/720',flush=True)
   browser.close();movie=out/'animation.mp4'
   subprocess.run(['ffmpeg','-y','-v','error','-framerate','60','-i',str(Path(temp)/'%04d.png'),'-r','60','-fps_mode','cfr','-frames:v','720','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:color=white','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
   report={'frames':720,'fpsEncoding':60,'durationMs':12000,'source':'Actual CSS circular portrait screenshots at controlled rAF times; fixed face/body plate and rigid rear locks','clip':clip,'bytes':movie.stat().st_size,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'browserErrors':errors,'physicalDisplayVerified':False}
   (out/'capture.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
assert not errors,errors
