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
 check(name+'_full_native_frame_no_crop',m['contentRect']=={'x':0,'y':0,'width':m['sourceWidth'],'height':m['sourceHeight']} and m['pixelGrid']=={'width':m['sourceWidth'],'height':m['sourceHeight']} and (m['width'],m['height'])==(m['sourceWidth'],m['sourceHeight']) and (m['tileWidth'],m['tileHeight'])==(m['sourceWidth'],m['sourceHeight']))
 check(name+'_indexed_palette_within_256_colors',0<len(m['palette'])<=256)
check('source_duration_and_frame_order',source['frameCount']==16 and source['frameDurationsMs']==[80]*16 and source['durationMs']==1280 and source['loop']==0)
group=smooth['frameCount']//source['frameCount']
check('smooth_keeps_original_period',smooth['frameCount']%source['frameCount']==0 and group>1 and smooth['durationMs']==source['durationMs'] and smooth['loop']==source['loop'] and all(sum(smooth['frameDurationsMs'][i*group:(i+1)*group])==duration for i,duration in enumerate(source['frameDurationsMs'])))
check('smooth_samples_cover_120hz_refresh',max(smooth['frameDurationsMs'])<=1000/120,{'estimatedSampleRate':smooth['frameCount']*1000/smooth['durationMs'],'maxSampleDurationMs':max(smooth['frameDurationsMs'])})
check('one_shared_palette',source['palette']==smooth['palette'])
check('no_generated_face_replacements',not source['provenance']['generatedFaces'] and not smooth['provenance']['generatedFaces'])
check('derived_motion_is_explicit',source['motionSource']=='source-timing' and smooth['motionSource']=='motion-compensated' and smooth['provenance']['derivedMotion'])
a=Image.open(base/source['atlas']).convert('RGBA');b=Image.open(base/smooth['atlas']).convert('RGBA')
def tile(image,m,index):
 x=index%m['atlasColumns']*m['tileWidth'];y=index//m['atlasColumns']*m['tileHeight'];return image.crop((x,y,x+m['tileWidth'],y+m['tileHeight']))
for i in range(source['frameCount']):
 x=tile(a,source,i).tobytes();y=tile(b,smooth,i*group).tobytes();difference=sum(x[k:k+4]!=y[k:k+4]for k in range(0,len(x),4));result['anchorPixelDifferences'].append(difference)
check('sixteen_smooth_anchors_match_source_pixels_exactly',all(v==0 for v in result['anchorPixelDifferences']),result['anchorPixelDifferences'])
canonical=Image.open(base/'canonical.png').convert('RGBA');expected=tile(a,source,0)
check('canonical_is_source_frame_zero_without_resampling',canonical.size==(source['sourceWidth'],source['sourceHeight']) and canonical.tobytes()==expected.tobytes())
source_pngs=[entry for entry in source['sources'] if entry['file'].endswith('.png')];derived=smooth['derivedInput']['frames']
original_differences=[]
for i,entry in enumerate(source_pngs):
 original=Image.open(ROOT/entry['file']).convert('RGBA');rendered=tile(a,source,i)
 original_bytes=original.tobytes();rendered_bytes=rendered.tobytes()
 original_differences.append(sum(original_bytes[k:k+4]!=rendered_bytes[k:k+4] for k in range(0,len(original_bytes),4)) if original.size==rendered.size else -1)
check('all_source_anchor_rgb_pixels_are_original_without_loss',len(original_differences)==source['frameCount'] and all(difference==0 for difference in original_differences),original_differences)
result['sourcePixelDifferences']=original_differences
check('source_anchor_input_bytes_are_original',all(source_pngs[i]['sha256']==derived[i*group]['sha256']for i in range(source['frameCount'])))
check('derived_uses_exact_original_palette_manifest',smooth['sharedPaletteSource']['sha256']==sha(base/'source-manifest.json'))
result['status']='passed'if not result['failures']else'failed';args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':result['status'],'checks':len(result['checks']),'failures':result['failures'],'anchorPixelDifferences':result['anchorPixelDifferences']}));raise SystemExit(0 if result['status']=='passed'else 1)
