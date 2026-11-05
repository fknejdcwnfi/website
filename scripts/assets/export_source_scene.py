#!/usr/bin/env python3
"""Source-controlled Browser Canvas pixel conversion; no AI frame replacement.

Default input is the user's 16 original frames and 80ms timing. Derived input may
be provided explicitly with a shared original palette and separate output prefix.
Python only writes Canvas-produced PNG bytes, hashes and provenance metadata.
"""
import argparse,base64,hashlib,json,io
from PIL import Image
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',default='http://127.0.0.1:5198/');p.add_argument('--grid-width',type=int,choices=[358],default=358);p.add_argument('--colors',type=int,choices=[256],default=256)
p.add_argument('--input-manifest',type=Path);p.add_argument('--output-prefix',default='source');p.add_argument('--palette-manifest',type=Path)
args=p.parse_args();source=ROOT/'reference-projects/fuji-wind/original';output=ROOT/'public/assets/reference-scene';output.mkdir(parents=True,exist_ok=True)
metadata=json.loads((source/'metadata.json').read_text());original_paths=[source/'frames'/f'frame_{i:03d}.png' for i in range(16)]
durations=metadata['frame_durations_ms'];paths=original_paths;derived=None
if args.input_manifest:
 source_manifest=args.input_manifest if args.input_manifest.is_absolute() else ROOT/args.input_manifest
 derived=json.loads(source_manifest.read_text());entries=derived.get('frames')
 if entries is None:
  entries=[{'file':str(source_manifest.parent/f'frame_{i:03d}.png'),'durationMs':derived['frame_duration_ms']}for i in range(derived['derived_frames'])]
 paths=[];durations=[]
 for i,entry in enumerate(entries):
  if isinstance(entry,str):name=entry;duration=derived.get('frameDurationsMs',[derived.get('frameDurationMs',10)]*len(entries))[i]
  else:name=entry.get('file',entry.get('path'));duration=entry.get('durationMs',entry.get('duration_ms',derived.get('frameDurationMs',10)))
  path=Path(name);path=path if path.is_absolute() else ROOT/path
  if not path.is_file():path=source_manifest.parent/name
  assert path.is_file(),path
  paths.append(path);durations.append(duration)
 assert args.output_prefix!='source','Derived frames require a distinct output prefix.'
 assert args.palette_manifest,'Derived frames must use the original shared palette.'
assert paths and len(paths)==len(durations) and all(isinstance(v,(int,float)) and 0<v<=60000 for v in durations)
assert abs(sum(durations)-sum(metadata['frame_durations_ms']))<.001,'Derived sequence duration must equal the original GIF period.'
assert args.output_prefix.replace('-','').isalnum()
palette=None
if args.palette_manifest:
 palette_manifest=args.palette_manifest if args.palette_manifest.is_absolute() else ROOT/args.palette_manifest
 palette=json.loads(palette_manifest.read_text())['palette']
def write_lossless_indexed(path,png):
 rgba=Image.open(io.BytesIO(png)).convert('RGBA')
 colors=rgba.getcolors(maxcolors=256)
 assert colors is not None,'Canvas output exceeded the shared palette.'
 palette=sorted(color for _,color in colors)
 lookup={bytes(color):i for i,color in enumerate(palette)}
 raw=rgba.tobytes();indices=bytes(lookup[raw[i:i+4]]for i in range(0,len(raw),4))
 indexed=Image.frombytes('P',rgba.size,indices)
 indexed.putpalette([channel for color in palette for channel in color[:3]]+[0]*(768-len(palette)*3))
 if any(color[3]!=255 for color in palette):indexed.info['transparency']=bytes(color[3]for color in palette)
 indexed.save(path,format='PNG',optimize=True)
 assert Image.open(path).convert('RGBA').tobytes()==raw,'Indexed PNG encoding changed scene pixels.'
 return {'colors':len(palette),'decodedMismatch':0}
def record(path):
 data=path.read_bytes()
 try:name=str(path.relative_to(ROOT))
 except ValueError:name=str(path)
 return{'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1200,'height':1000});page.route('**/@vite/client',lambda route:route.abort());page.route('**/src/main.tsx*',lambda route:route.abort());page.goto(args.url)
 result=page.evaluate('''async({paths,grid,colors,palette})=>{const {authorSourceSequence}=await import('/src/authoring/referenceScene/sourcePixels.ts');const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src});return authorSourceSequence(await Promise.all(paths.map(load)),grid,colors,palette??undefined)}''',{'paths':[f'/@fs{path}' for path in paths],'grid':args.grid_width,'colors':args.colors,'palette':palette});browser.close()
assert result['atlasMismatches']==0,result['atlasMismatches']
prefix=args.output_prefix;atlas=output/f'{prefix}-atlas.png';atlas_encoding=write_lossless_indexed(atlas,base64.b64decode(result.pop('atlas')))
frames=result.pop('frames');canonical=output/'canonical.png'
if prefix=='source':canonical_encoding=write_lossless_indexed(canonical,base64.b64decode(frames[0]))
else:
 expected=Image.open(io.BytesIO(base64.b64decode(frames[0]))).convert('RGBA')
 assert canonical.is_file() and Image.open(canonical).convert('RGBA').tobytes()==expected.tobytes(),'Derived frame zero must reproduce the source canonical exactly.'
 canonical_encoding={'colors':len(expected.getcolors(maxcolors=256)),'decodedMismatch':0}
 stale=output/f'{prefix}-canonical.png'
 if stale.is_file():stale.unlink()
manifest={'version':1,'motionSource':'motion-compensated' if derived else 'source-timing','width':result['width'],'height':result['height'],'sourceWidth':358,'sourceHeight':267,'frameCount':len(paths),'frameDurationsMs':durations,'durationMs':sum(durations),'sourceAnchorCount':16,'sourceLoop':metadata['loop'],'loop':metadata['loop'],'atlas':atlas.name,'canonical':canonical.name,'tileWidth':result['tileWidth'],'tileHeight':result['tileHeight'],'atlasColumns':result['columns'],'atlasRows':result['rows'],'pixelGrid':{'width':result['gridWidth'],'height':result['gridHeight']},'contentRect':{'x':0,'y':0,'width':result['width'],'height':result['height']},'aspectAdjustment':{'source':358/267,'output':358/267,'relativeDifference':0,'mode':'source-native pixels; no resampling or crop'},'palette':result['palette'],'frameChecksums':result['checksums'],'atlasMismatches':result['atlasMismatches'],'pngEncoding':{'method':'explicit lossless indexed RGBA palette; no color quantization at encode','atlas':atlas_encoding,'canonical':canonical_encoding},'provenance':{'kind':'source-native Canvas indexed pixels','derivedMotion':bool(derived),'generatedFaces':False,'note':'All source anchor frames retain original order, positions and timing. Native source coordinates and all 255 source colors are preserved without downsampling; derived samples are mapped to the same palette. Any explicitly supplied derived interframes are recorded separately; there is no AI-generated frame replacement.'},'sources':[record(source/'original.gif'),record(source/'metadata.json')]+[record(path)for path in original_paths],'authoring':[record(ROOT/'src/authoring/referenceScene/sourcePixels.ts'),record(ROOT/'scripts/assets/export_source_scene.py')],'files':[record(canonical),record(atlas)]}
if derived:manifest['authoring'].append(record(ROOT/'scripts/assets/derive_reference_motion.py'))
if derived:manifest['derivedInput']={'manifest':record(source_manifest),'frames':[record(path)for path in paths],'description':derived.get('description',derived.get('method','explicit derived frame sequence'))}
if args.palette_manifest:manifest['sharedPaletteSource']=record(palette_manifest)
(output/f'{prefix}-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# The small generated descriptor is bundled, protecting versioned atlas URLs.
def descriptor(path):
 m=json.loads(path.read_text());f={Path(v['file']).name:v for v in m['files']}
 return {key:m[key]for key in ['version','motionSource','width','height','sourceWidth','sourceHeight','tileWidth','tileHeight','frameCount','frameDurationsMs','durationMs','loop','atlasColumns','atlasRows']}|{'atlas':m['atlas'],'canonical':m['canonical'],'canonicalSha256':f[m['canonical']]['sha256'],'atlasSha256':f[m['atlas']]['sha256'],'atlasBytes':f[m['atlas']]['bytes'],'atlasWidth':m['atlasColumns']*m['tileWidth'],'atlasHeight':m['atlasRows']*m['tileHeight']}
compiled='// Generated by scripts/assets/export_source_scene.py; do not edit.\n'
for name,label in [('source','sourceAssetManifest'),('smooth','smoothAssetManifest')]:
 path=output/f'{name}-manifest.json'
 if path.is_file():compiled+='export const '+label+' = '+json.dumps(descriptor(path),ensure_ascii=False,indent=2)+' as const\n'
(ROOT/'src/features/referenceScene/sourceAssets.ts').write_text(compiled)
print(json.dumps({'output' :str(output),'frameCount':len(paths),'durationMs':sum(durations),'tileSize':[result['tileWidth'],result['tileHeight']],'atlasSize':[result['tileWidth']*result['columns'],result['tileHeight']*result['rows']],'palette':len(result['palette']),'atlasMismatches':0,'bytes':sum(entry['bytes'] for entry in manifest['files'])}))
