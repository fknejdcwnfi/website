#!/usr/bin/env python3
"""Capture actual source-timed Canvas/CSS frames, not a generated replacement movie."""
import argparse,json,hashlib,subprocess,time,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
from capture_portrait import CONTROLLED_RAF
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:4173/website/');p.add_argument('--output',type=Path,default=ROOT/'artifacts/reference-scene/preview');args=p.parse_args()
out=args.output;out.mkdir(parents=True,exist_ok=True);scratch=ROOT/'work/reference-scene/capture';scratch.mkdir(parents=True,exist_ok=True)
errors=[];start=time.monotonic()
with sync_playwright()as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1100});page.add_init_script(CONTROLLED_RAF);page.on('pageerror',lambda e:errors.append(str(e)));page.goto(args.url);page.wait_for_selector('canvas[data-ready=true][data-playback=looping]')
 canvas=page.locator('.reference-scene canvas');count=384
 for frame in range(count):
  page.evaluate('(t)=>window.__captureStep(t)',frame*1000/60)
  png=canvas.evaluate('c=>c.toDataURL()');(scratch/f'frame_{frame:04d}.png').write_bytes(base64.b64decode(png.split(',')[1]))
  if frame%80==0:print(f'Captured {frame}/{count}',flush=True)
 browser.close()
assert not errors,errors
movie=out/'animation.mp4'
subprocess.run(['ffmpeg','-y','-v','error','-framerate','60','-i',str(scratch/'frame_%04d.png'),'-frames:v','384','-vf','scale=640:480:flags=neighbor','-c:v','libx264','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(movie),'-vf','fps=12.5,scale=320:240,tile=4x4','-frames:v','1',str(out/'contact.png')],check=True)
report={'source':'Actual production ReferenceScene Canvas, controlled rAF timestamps; native320x240 Canvas PNG, integer2x nearest scaling; complete4:3 scene','fpsEncoding':60,'frames':384,'durationMs':6400,'sourceLoops':5,'bytes':movie.stat().st_size,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'browserErrors':errors,'captureWallSeconds':round(time.monotonic()-start,3),'interpretation':'This is a60fps encoded review, not a physical display FPS capture. Source contains16 original anchors plus explicitly estimated intermediate samples.'}
(out/'capture.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
