#!/usr/bin/env python3
"""Verify the stable portrait's small, independent assets without imaging dependencies."""
import hashlib,json,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
 base=ROOT/'public/assets/calm-circle';m=json.loads((base/'manifest.json').read_text())
 assert m['motionKind']=='local-rigid-locks' and m['periodMs']==12000 and m['blinkCycleMs']==24000
 assert (m['width'],m['height'])==(716,534) and len(m['hair'])==2
 assert all(0<h['maxAngle']<=.022 for h in m['hair'])
 for category in ['sources','authoring','files']:
  for item in m[category]:
   p=ROOT/item['file'];assert p.resolve().is_relative_to(ROOT)
   b=p.read_bytes();assert len(b)==item['bytes'] and hashlib.sha256(b).hexdigest()==item['sha256'],'Stale calm asset: '+item['file']
 for name,a in m['assets'].items():
  p=base/a['file'];b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(716,534)
  assert hashlib.sha256(b).hexdigest()==a['sha256']
 text=(ROOT/'src/features/calmPortrait/assets.ts').read_text();compiled=json.JSONDecoder().raw_decode(text[text.index('{'):])[0]
 assert all(m[key]==value for key,value in compiled.items()),'Stale calm runtime descriptor'
 print('calm portrait verified: fixed canonical, independent hair, local eyelids, original-pixel asset provenance')
 return 0
if __name__=='__main__':
 try:raise SystemExit(main())
 except (ValueError,KeyError,AssertionError,OSError)as error:print('Calm portrait verification failed:',error,file=sys.stderr);raise SystemExit(1)
