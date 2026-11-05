#!/usr/bin/env python3
"""Byte/provenance checks for the owner-supplied source; no archive code is executed."""
import hashlib,json,struct,sys,zipfile
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[2]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 base=ROOT/'reference-projects/fuji-wind';provenance=json.loads((base/'provenance.json').read_text());archive=base/'source-project.zip'
 assert sha(archive)==provenance['archiveSha256'],'Original ZIP changed'
 with zipfile.ZipFile(archive)as z:
  assert z.testzip() is None,'ZIP CRC failed'
  expected=[]
  for entry in z.infolist():
   name=PurePosixPath(entry.filename)
   assert not name.is_absolute() and '..'not in name.parts,'Unsafe ZIP entry'
   if entry.is_dir():continue
   relative=PurePosixPath(*name.parts[1:]);path=base/'original'/relative
   assert path.is_file() and path.read_bytes()==z.read(entry),'Unpacked source mismatch: '+str(relative)
   expected.append(str(relative))
  assert sorted(expected)==sorted(p['path']for p in provenance['originalFiles']),'Incomplete archive inventory'
 for entry in provenance['originalFiles']:
  path=base/'original'/entry['path'];assert path.stat().st_size==entry['bytes'] and sha(path)==entry['sha256'],'Original source changed'
 meta=json.loads((base/'original/metadata.json').read_text());assert meta['frame_count']==16 and meta['frame_durations_ms']==[80]*16 and meta['frame_width']==358 and meta['frame_height']==267
 gif=(base/'original/original.gif').read_bytes();assert gif[:6]in(b'GIF87a',b'GIF89a')and struct.unpack('<HH',gif[6:10])==(358,267)
 for prefix in ['source','smooth']:
  m=json.loads((ROOT/f'public/assets/reference-scene/{prefix}-manifest.json').read_text())
  assert m['durationMs']==1280 and m['width']==320 and m['height']==240
  assert m['frameCount']==(16 if prefix=='source' else 128)
  for kind in ['sources','authoring','files']:
   for e in m[kind]:
    path=ROOT/e['file'];assert path.is_file()and path.stat().st_size==e['bytes']and sha(path)==e['sha256'],'Stale reference dependency: '+e['file']
  for e in m['files']:
   if e['file'].endswith('.png'):
    blob=(ROOT/e['file']).read_bytes();assert blob[:8]==b'\x89PNG\r\n\x1a\n'
  atlas=ROOT/'public/assets/reference-scene'/m['atlas'];assert struct.unpack('>II',atlas.read_bytes()[16:24])==(m['tileWidth']*m['atlasColumns'],m['tileHeight']*m['atlasRows'])
 print('reference project verified: full ZIP/extracted bytes, source timing, authoring and published atlases')
 return 0
if __name__=='__main__':
 try:raise SystemExit(main())
 except (AssertionError,KeyError,ValueError,OSError,zipfile.BadZipFile)as error:print('Reference verification failed:',error,file=sys.stderr);raise SystemExit(1)
