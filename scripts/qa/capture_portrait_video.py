#!/usr/bin/env python3
"""Encode a 60-fps review video from actual production-player CSS screenshots.

Controlled timestamps select real rendered frames; encoding rate is not a
physical-display benchmark. No motion interpolation or generated faces are used.
"""
import argparse,hashlib,json,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from capture_portrait import CONTROLLED_RAF
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4173/website/')
parser.add_argument('--fps',type=int,default=60)
parser.add_argument('--duration-ms',type=int,default=12000)
parser.add_argument('--output',type=Path,default=ROOT/'artifacts/video-layered/portrait/animation-60fps.mp4')
args=parser.parse_args()
assert 1<=args.fps<=120 and 1000<=args.duration_ms<=24000
count=round(args.duration_ms*args.fps/1000)
scratch=ROOT/'work/video-rebuild/video60';scratch.mkdir(parents=True,exist_ok=True)
args.output.parent.mkdir(parents=True,exist_ok=True)
started=time.monotonic();digest=hashlib.sha256();errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.add_init_script(CONTROLLED_RAF)
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto(args.url);page.wait_for_selector('canvas[data-ready=true][data-painted=true][data-playback=looping]',timeout=30000)
 page.evaluate('document.fonts.ready')
 assert page.locator('canvas').get_attribute('data-renderer')=='layered-arc-mesh'
 clip=page.locator('.portrait-viewport__art')
 for frame in range(count):
  page.evaluate('(time)=>window.__captureStep(time)',frame*1000/args.fps)
  png=clip.screenshot();(scratch/f'frame_{frame:04d}.png').write_bytes(png);digest.update(png)
  if (frame+1)%120==0:print(f'Captured {frame+1}/{count}',flush=True)
 browser.close()
assert not errors,errors
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(args.fps),'-i',str(scratch/'frame_%04d.png'),'-frames:v',str(count),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(args.output)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate,nb_frames:format=duration','-of','json',str(args.output)]))
assert int(probe['streams'][0]['nb_frames'])==count
metadata={'url':args.url,'source':'Actual production PortraitPlayer at controlled rAF timestamps; CSS circular viewport screenshots','fps':args.fps,'frames':count,'duration_ms':args.duration_ms,'frame_sequence_sha256':digest.hexdigest(),'file':args.output.name,'bytes':args.output.stat().st_size,'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),'probe':probe,'browser_errors':errors,'capture_wall_seconds':round(time.monotonic()-started,3),'interpretation':'A rendered review video at 60-fps encoding; controlled timestamp capture is not real-time or physical-refresh FPS evidence. H264 color encoding is lossy; raw Canvas PNGs remain the pixel authority.'}
args.output.with_suffix('.json').write_text(json.dumps(metadata,indent=2)+'\n');print(json.dumps(metadata))
