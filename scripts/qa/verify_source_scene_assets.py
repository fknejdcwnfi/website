#!/usr/bin/env python3
"""Verify source-controlled frame assets and exact anchors in the smooth atlas."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=ROOT/'artifacts/reference-scene/source-assets.json');args=p.parse_args()
base=ROOT/'public/assets/reference-scene';source=json.loads((base/'source-manifest.json').read_text());smooth=json.loads((base/'smooth-manifest.json').read_text())
result={'status':'failed','checks':[],'failures':[],'sourceFrames':source['frameCount'],'smoothFrames':smooth['frameCount'],'sourcePeriodMs':source['durationMs'],'smoothPeriodMs':smooth['durationMs'],'anchorPixelDifferences':[]}
def check(name,condition,detail=None):
 result['checks'].append({'name':name,'passed':bool(condition),'detail':detail})
 if not condition:result['failures'].append(name)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
for name,m in [('source',source),('smooth',smooth)]:
 for category in ['sources','authoring','files']:
  for entry in m[category]:
   path=ROOT/entry['file'];check(name+'_'+category+'_'+entry['file'],path.is_file() and path.stat().st_size==entry['bytes'] and sha(path)==entry['sha256'])
 image=Image.open(base/m['atlas']).convert('RGBA')
 check(name+'_atlas_dimensions',image.size==(m['tileWidth']*m['atlasColumns'],m['tileHeight']*m['atlasRows']),list(image.size))
 colors=image.getcolors(maxcolors=256);check(name+'_shared_palette_budget',colors is not None and len(colors)<=len(m['palette']),len(colors)if colors else None)
 check(name+'_opaque_frames',image.getextrema()[3]==(255,255))
 check(name+'_packing_and_encoding_are_lossless',m['atlasMismatches']==0 and m['pngEncoding']['atlas']['decodedMismatch']==0 and m['pngEncoding']['canonical']['decodedMismatch']==0)
 check(name+'_full_frame_no_crop',m['contentRect']=={'x':0,'y':0,'width':320,'height':240} and m['pixelGrid']=={'width':160,'height':120})
check('source_duration_and_frame_order',source['frameCount']==16 and source['frameDurationsMs']==[80]*16 and source['durationMs']==1280 and source['loop']==0)
check('smooth_keeps_original_period',smooth['frameCount']==128 and smooth['frameDurationsMs']==[10]*128 and smooth['durationMs']==1280 and smooth['loop']==source['loop'])
check('one_shared_palette',source['palette']==smooth['palette'])
check('no_generated_face_replacements',not source['provenance']['generatedFaces'] and not smooth['provenance']['generatedFaces'])
check('derived_motion_is_explicit',source['motionSource']=='source-timing' and smooth['motionSource']=='motion-compensated' and smooth['provenance']['derivedMotion'])
a=Image.open(base/source['atlas']).convert('RGBA');b=Image.open(base/smooth['atlas']).convert('RGBA')
def tile(image,m,index):
 x=index%m['atlasColumns']*m['tileWidth'];y=index//m['atlasColumns']*m['tileHeight'];return image.crop((x,y,x+m['tileWidth'],y+m['tileHeight']))
for i in range(16):
 x=tile(a,source,i).tobytes();y=tile(b,smooth,i*8).tobytes();difference=sum(x[k:k+4]!=y[k:k+4]for k in range(0,len(x),4));result['anchorPixelDifferences'].append(difference)
check('sixteen_smooth_anchors_match_source_pixels_exactly',all(v==0 for v in result['anchorPixelDifferences']),result['anchorPixelDifferences'])
canonical=Image.open(base/'canonical.png').convert('RGBA');expected=tile(a,source,0).resize((320,240),Image.Resampling.NEAREST)
check('canonical_is_source_frame_zero_at_integer_pixel_scale',canonical.tobytes()==expected.tobytes())
source_pngs=source['sources'][2:];derived=smooth['derivedInput']['frames']
check('source_anchor_input_bytes_are_original',all(source_pngs[i]['sha256']==derived[i*8]['sha256']for i in range(16)))
check('derived_uses_exact_original_palette_manifest',smooth['sharedPaletteSource']['sha256']==sha(base/'source-manifest.json'))
result['status']='passed'if not result['failures']else'failed';args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':result['status'],'checks':len(result['checks']),'failures':result['failures'],'anchorPixelDifferences':result['anchorPixelDifferences']}));raise SystemExit(0 if result['status']=='passed'else 1)
