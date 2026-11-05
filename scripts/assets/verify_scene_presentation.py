#!/usr/bin/env python3
"""Standard-library checks for the Minecraft scene, its artwork and build inputs."""
import hashlib,json,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'public/assets/reference-scene'

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def png_size(path):
 data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n',path
 return struct.unpack('>II',data[16:24])
def bound_record(entry):
 path=ROOT/entry['file']
 assert path.resolve().is_relative_to(ROOT),'Invalid presentation dependency'
 assert path.is_file() and path.stat().st_size==entry['bytes'] and sha(path)==entry['sha256'],'Stale presentation input: '+entry['file']
def main():
 m=json.loads((BASE/'presentation-manifest.json').read_text())
 assert m['version']==2 and (m['width'],m['height'])==(716,534)
 assert m['sourceFrames']==16 and m['derivedFrames']==160 and m['durationMs']==1280 and m['frameDurationsMs']==[8]*160
 assert len(m['poseFields'])==16 and len(m['eyelidClosure'])==160
 assert m['eyelidClosure'][60]==0 and m['eyelidClosure'][70]==1 and m['eyelidClosure'][80]==1 and m['eyelidClosure'][90]==0
 for category in ['sources','poseFields','authoring','files']:
  for entry in m[category]:bound_record(entry)
 assert png_size(BASE/m['assets']['canonical']['file'])==(716,534)
 for prefix,count,step in [('pixel-source',16,80),('pixel-smooth',160,8)]:
  a=json.loads((BASE/f'{prefix}-manifest.json').read_text())
  assert a['frameCount']==count and a['frameDurationsMs']==[step]*count and a['durationMs']==1280 and a['sourceAnchorCount']==16
  assert (a['tileWidth'],a['tileHeight'])==(358,267)
  assert png_size(BASE/a['atlas'])==(a['atlasWidth'],a['atlasHeight'])
  assert sha(BASE/a['atlas'])==a['atlasSha256'] and (BASE/a['atlas']).stat().st_size==a['atlasBytes']
  assert len(a['frameChecksums'])==count and len(a['eyelidClosure'])==count
 video=m['video'];assert video['r_frame_rate']=='125/1' and int(video['nb_frames'])==160 and float(video['duration'])==1.28
 blob=(BASE/m['assets']['boot']['file']).read_bytes()
 assert b'ftyp' in blob[:16] and 0<blob.find(b'moov')<blob.find(b'mdat'),'Video is not progressive MP4'
 # Descriptor values are plain generated JSON: no TypeScript evaluation in CI.
 text=(ROOT/'src/features/referenceScene/presentationAssets.ts').read_text()
 compiled=json.JSONDecoder().raw_decode(text[text.index('{'):])[0]
 assert compiled==m['assets'],'Stale compiled presentation descriptor'
 text=(ROOT/'src/features/referenceScene/pixelAssets.ts').read_text()
 for prefix,name in [('pixel-source','sourceAssetManifest'),('pixel-smooth','smoothAssetManifest')]:
  offset=text.index('export const '+name+' = ')+len('export const '+name+' = ')
  compiled=json.JSONDecoder().raw_decode(text[offset:])[0]
  full=json.loads((BASE/f'{prefix}-manifest.json').read_text())
  assert all(full.get(key)==value for key,value in compiled.items()),'Stale compiled pixel descriptor'
 for name,asset in m['assets'].items():
  assert asset['sha256']==sha(BASE/asset['file']),'Stale '+name
 print('Minecraft presentation verified: one artwork master, pose fields, timing, progressive video and HD pixels')
 return 0
if __name__=='__main__':
 try:raise SystemExit(main())
 except (AssertionError,ValueError,KeyError,OSError)as error:print('Presentation verification failed:',error,file=sys.stderr);raise SystemExit(1)
