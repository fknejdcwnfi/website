#!/usr/bin/env python3
"""Export small binary selection grids through the browser's exact nearest sampling.

The original generated matte is retained unchanged. This is a build-time
selection-data export; canonical colors and artwork are never edited.
"""
import argparse,base64,hashlib,json,struct
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:5173/')
args=parser.parse_args()
source=ROOT/'assets/generated/portrait-rig/hair-matte.png'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page();page.goto(args.url.rstrip('/')+'/favicon.svg')
 exported=page.evaluate('''async path=>{
  const image=new Image();image.src=path;await image.decode();
  return [192,256,320].map(size=>{
   const canvas=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=canvas.height=size;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,size,size);
   const data=ctx.getImageData(0,0,size,size);
   for(let i=0;i<data.data.length;i+=4){
    const white=data.data[i]+data.data[i+1]+data.data[i+2]>=384?255:0;
    data.data[i]=data.data[i+1]=data.data[i+2]=white;data.data[i+3]=255;
   }
   ctx.putImageData(data,0,0);return {size,png:canvas.toDataURL('image/png').split(',')[1]};
  });
 }''','/@fs'+str(source))
 browser.close()
paths=[source]
for entry in exported:
 size=entry['size'];suffix='' if size==256 else f'-{size}'
 path=ROOT/f'public/assets/portrait-rig/hair-matte{suffix}.png'
 path.write_bytes(base64.b64decode(entry['png']));paths.append(path)
entries=[]
for path in paths:
 data=path.read_bytes();width,height=struct.unpack('>II',data[16:24]);entries.append({'file':str(path.relative_to(ROOT)),'bytes':len(data),'width':width,'height':height,'sha256':hashlib.sha256(data).hexdigest()})
canonical=ROOT/'assets/generated/portrait-v4/open.png'
manifest={'purpose':'Selection only; nearest binary grid exports from the retained generated matte. No visible colors are supplied by this material.','canonical':str(canonical.relative_to(ROOT)),'canonical_sha256':hashlib.sha256(canonical.read_bytes()).hexdigest(),'files':entries}
(ROOT/'public/assets/portrait-rig/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'master_bytes':entries[0]['bytes'],'runtime_bytes':sum(e['bytes'] for e in entries[1:]),'files':entries[1:]}))
