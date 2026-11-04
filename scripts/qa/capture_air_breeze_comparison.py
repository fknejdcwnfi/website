import argparse,base64,io,json,subprocess,tempfile
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description='Compare rejected PR12 physics with current source using the actual same pixel rig;10fps review, not display FPS.')
parser.add_argument('--url',default='http://127.0.0.1:5180/')
parser.add_argument('--output',type=Path,default=ROOT/'artifacts/air-breeze/comparison')
args=parser.parse_args();out=args.output;out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='vermouth-comparison-') as scratch:
 cache=Path(scratch)/'baseline-cache.json'
 subprocess.run(['node',str(ROOT/'scripts/qa/review_air_breeze.mjs'),str(out.parent/'motion-review.json'),str(cache)],cwd=ROOT,check=True)
 old_cache=json.loads(cache.read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);q=b.new_page(viewport={'width':1200,'height':1000});q.goto(args.url.rstrip('/')+'/?view=portrait&pose=1');q.wait_for_selector('canvas[data-ready=true]')
 data=q.evaluate('''async(oldCache)=>{
 const{loadBakedMaterials}=await import('/src/features/portrait/renderer/bakedMaterials.ts');
 const{PortraitRig}=await import('/src/features/portrait/renderer/portraitRig.ts');
 const{HairPhysics}=await import('/src/features/portrait/renderer/hairPhysics.ts?review='+Date.now());
 const{createMotionTable}=await import('/src/features/portrait/animation/portraitTimeline.ts');
 const materials=await loadBakedMaterials('/assets/portrait-rig/',256),config={direction:1,gust:.35,stiffness:18,damping:5};
 for(const key of ['rest','poses'])oldCache[key]=oldCache[key].map(a=>Float32Array.from(a));
 const modes=[new HairPhysics(materials.locks,config,256,oldCache),new HairPhysics(materials.locks,config,256)];
 const table=createMotionTable(config),frames=[];
 for(const [mode,physics]of modes.entries()){
  const rig=new PortraitRig(materials);rig.physics=physics;
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  const phase=[];
  for(let i=0;i<120;i++){rig.paint(ctx,table,i*100,1,1);phase.push(c.toDataURL());}
  frames.push(phase);
 }
 return frames;
 }''',old_cache)
 b.close()
 allframes=[]
 mask=Image.new('L',(256,256));ImageDraw.Draw(mask).ellipse((0,0,255,255),fill=255)
 sheets=[]
 for mode,frames in enumerate(data):
  sheet=Image.new('RGB',(1024,768),'white')
  for i,f in enumerate(frames):
   rgba=Image.open(io.BytesIO(base64.b64decode(f.split(',')[1]))).convert('RGBA')
   im=Image.new('RGB',(256,256),'white');im.paste(rgba,mask=rgba.getchannel('A'));im.paste('white',mask=Image.eval(mask,lambda v:255-v))
   if i%10==0:sheet.paste(im,((i//10)%4*256,(i//10)//4*256))
   if mode==0:allframes.append(Image.new('RGB',(512,280),'white'))
   allframes[i].paste(im,(mode*256,24));ImageDraw.Draw(allframes[i]).text((mode*256+6,6),['PR12 upward load','Current lateral breeze'][mode],fill='black')
  sheet.save(out/f'mode-{mode}.png');sheets.append(sheet)
 allframes[0].save(out/'side-by-side.gif',save_all=True,append_images=allframes[1:],duration=100,loop=0)
if not (out/'README.md').exists():
 (out/'README.md').write_text('Same original materials rendered by PortraitRig, comparing PR12 physical cache with current source.\n120 raw Canvas frames per version,100ms timestamps, nearest pixel display and circle mask; no motion interpolation or face switching. This10fps side-by-side GIF is a review artifact, not production high-refresh FPS.\n')
print('Created independent rig comparison contact sheets and120-frame GIF in',out)
