#!/usr/bin/env python3
"""Verify a color-only pixel derivative without Pillow, NumPy or archive code.

An independent PNG decoder constrains every output coordinate to its own native
2x2 source cluster, with exact thin-feature preservation. This detects reordering,
remote retargeting and unrecorded source changes beyond ordinary file hashes.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import struct
import sys
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[2]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def png_rgb(blob):
    """Decode the 8-bit non-interlaced RGB/RGBA/indexed PNGs used by this project."""
    assert blob[:8]==b'\x89PNG\r\n\x1a\n','Not a PNG'
    position=8;palette=None;compressed=[];header=None
    while position<len(blob):
        length=struct.unpack('>I',blob[position:position+4])[0]
        name=blob[position+4:position+8]
        data=blob[position+8:position+8+length]
        crc=struct.unpack('>I',blob[position+8+length:position+12+length])[0]
        assert zlib.crc32(name+data)&0xffffffff==crc,'PNG CRC mismatch'
        position+=12+length
        if name==b'IHDR':header=struct.unpack('>IIBBBBB',data)
        elif name==b'PLTE':palette=[tuple(data[index:index+3]) for index in range(0,len(data),3)]
        elif name==b'IDAT':compressed.append(data)
        elif name==b'IEND':break
    assert header is not None,'Missing PNG header'
    width,height,depth,color,compression,filter_method,interlace=header
    assert 0<width<=8192 and 0<height<=8192 and depth==8 and color in (2,3,6)
    assert compression==filter_method==interlace==0,'Unsupported PNG encoding'
    channels={2:3,3:1,6:4}[color];stride=width*channels
    raw=zlib.decompress(b''.join(compressed))
    assert len(raw)==height*(stride+1),'PNG decoded size mismatch'
    result=bytearray();previous=bytearray(stride)
    for y in range(height):
        offset=y*(stride+1);filter_type=raw[offset];row=bytearray(raw[offset+1:offset+1+stride])
        assert 0<=filter_type<=4,'Invalid PNG row filter'
        for x in range(stride):
            left=row[x-channels] if x>=channels else 0
            above=previous[x]
            upper_left=previous[x-channels] if x>=channels else 0
            if filter_type==1:prediction=left
            elif filter_type==2:prediction=above
            elif filter_type==3:prediction=(left+above)//2
            elif filter_type==4:
                p=left+above-upper_left
                pa,pb,pc=abs(p-left),abs(p-above),abs(p-upper_left)
                prediction=left if pa<=pb and pa<=pc else above if pb<=pc else upper_left
            else:prediction=0
            row[x]=(row[x]+prediction)&255
        if color==2:result.extend(row)
        elif color==6:
            for x in range(0,stride,4):
                assert row[x+3]==255,'Unexpected transparent source-frame pixel'
                result.extend(row[x:x+3])
        else:
            assert palette is not None,'Missing indexed palette'
            for index in row:result.extend(palette[index])
        previous=row
    return width,height,bytes(result)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upload',type=Path,help='Optional freshly uploaded ZIP: verify it equals the preserved complete archive')
    parser.add_argument('--output',type=Path,help='Optional machine-readable evidence file')
    args=parser.parse_args()
    base=ROOT/'public/assets/faithful-pixel'
    manifest=json.loads((base/'manifest.json').read_text())
    source=ROOT/'reference-projects/fuji-wind'
    provenance=json.loads((source/'provenance.json').read_text())
    archive=(source/'source-project.zip').read_bytes()
    assert sha(archive)==provenance['archiveSha256']==manifest['sourceArchiveSha256'],'Original ZIP provenance mismatch'
    if args.upload:assert args.upload.read_bytes()==archive,'Re-upload differs from preserved ZIP'
    inventory={entry['path']:entry for entry in provenance['originalFiles']}
    with zipfile.ZipFile(source/'source-project.zip') as uploaded:
        assert uploaded.testzip() is None,'Source ZIP CRC mismatch'
        entries=[]
        for entry in uploaded.infolist():
            if entry.is_dir():continue
            path=PurePosixPath(entry.filename)
            assert not path.is_absolute() and '..' not in path.parts,'Unsafe source archive entry'
            relative=str(PurePosixPath(*path.parts[1:]));entries.append(relative)
            blob=uploaded.read(entry)
            assert relative in inventory and blob==(source/'original'/relative).read_bytes()
            assert len(blob)==inventory[relative]['bytes'] and sha(blob)==inventory[relative]['sha256'],'Source file changed: '+relative
        assert sorted(entries)==sorted(inventory) and len(entries)==22,'Incomplete original archive inventory'
    assert manifest['version']==1 and manifest['width']==manifest['tileWidth']==358 and manifest['height']==manifest['tileHeight']==267
    assert manifest['frameCount']==16 and manifest['frameDurationsMs']==[80]*16 and manifest['durationMs']==1280 and manifest['loop']==0
    assert manifest['atlasColumns']==manifest['atlasRows']==4
    assert manifest['canonicalWidth']==716 and manifest['canonicalHeight']==534
    for category in ('authoring','files'):
        for entry in manifest[category]:
            path=ROOT/entry['file']
            assert path.resolve().is_relative_to(ROOT),'Unsafe derivative path'
            blob=path.read_bytes()
            assert len(blob)==entry['bytes'] and sha(blob)==entry['sha256'],'Stale faithful derivative: '+entry['file']
    atlas_blob=(base/manifest['atlas']).read_bytes()
    assert sha(atlas_blob)==manifest['atlasSha256']
    atlas_width,atlas_height,atlas=png_rgb(atlas_blob)
    assert (atlas_width,atlas_height)==(1432,1068)
    canonical_blob=(base/manifest['canonical']).read_bytes()
    assert sha(canonical_blob)==manifest['canonicalSha256']
    canonical_width,canonical_height,canonical=png_rgb(canonical_blob)
    assert (canonical_width,canonical_height)==(716,534)
    mapping={tuple(item['source']):bytes(item['target']) for item in manifest['colorMapping']}
    assert len(mapping)==len(manifest['colorMapping'])==255,'Expected complete original color mapping'
    palette={tuple(color) for color in manifest['palette']}
    assert set(tuple(value) for value in mapping.values())<=palette,'Mapping refers to unknown pixel palette color'
    assert len(palette)<255,'The derivative has not changed the original color language'
    frames=manifest['frames'];assert len(frames)==16
    source_pixels=set();changed=0;frame_zero=None;clustered_changes=0
    for index,entry in enumerate(frames):
        assert entry['index']==index and entry['durationMs']==80
        expected_source=source/f'original/frames/frame_{index:03}.png'
        assert (ROOT/entry['sourceFile']).resolve()==expected_source.resolve(),'Source frame reordered'
        blob=expected_source.read_bytes();assert sha(blob)==entry['sourceSha256']
        width,height,original=png_rgb(blob)
        assert (width,height)==(358,267) and sha(original)==entry['sourcePixelSha256']
        mapped=[]
        for offset in range(0,len(original),3):
            color=tuple(original[offset:offset+3]);source_pixels.add(color)
            assert color in mapping,'Original color absent from fixed mapping'
            mapped.append(mapping[color])
        x0,y0=index%4*358,index//4*267
        tile=b''.join(atlas[((y0+y)*atlas_width+x0)*3:((y0+y)*atlas_width+x0+358)*3] for y in range(267))
        assert sha(tile)==entry['outputPixelSha256'],'Output pixel checksum mismatch'
        # Independent coordinate support proof: a block can only select one of
        # the colors already in that original aligned block, never another pose
        # or a flow-displaced source coordinate. Protected details stay native.
        for y in range(267):
            for x in range(358):
                position=y*358+x
                rgb=tile[position*3:position*3+3]
                own=mapped[position]
                block=[mapped[yy*358+xx] for yy in range(y//2*2,min(y//2*2+2,267))
                       for xx in range(x//2*2,min(x//2*2+2,358))]
                assert rgb in block,'Output color sampled outside its own native2x2 block'
                protected=(115<=x<249 and 82<=y<111) or (157<=x<210 and 137<=y<153) or (
                    own[2]>own[0]+20 and own[1]>own[0]+8 and y>111 and 105<x<263) or (
                    184<=y<264 and 2126*own[0]+7152*own[1]+722*own[2]<1150000 and
                    (abs(x-(130+(y-184)*5/7))<8 or abs(x-(234-(y-184)*5/7))<8))
                if protected:assert rgb==own,'Native thin feature changed'
                else:
                    histogram={value:block.count(value) for value in set(block)}
                    winner=min(histogram,key=lambda value:(-histogram[value],2126*value[0]+7152*value[1]+722*value[2],tuple(value)))
                    assert rgb==winner,'Non-protected cluster differs from its dominant native color'
                changed+=rgb!=original[position*3:position*3+3]
                clustered_changes+=rgb!=own
        if index==0:frame_zero=tile
    assert len(source_pixels)==255 and changed>0,'Source colors were not converted'
    assert frame_zero is not None
    for y in range(534):
        row=canonical[y*716*3:(y+1)*716*3]
        original=frame_zero[(y//2)*358*3:(y//2+1)*358*3]
        expected=b''.join(original[x:x+3]*2 for x in range(0,len(original),3))
        assert row==expected,'Canonical is not exact nearest-neighbor frame zero'
    compiled_text=(ROOT/'src/features/faithfulPixel/assets.ts').read_text()
    compiled=json.JSONDecoder().raw_decode(compiled_text[compiled_text.index('{'):])[0]
    assert all(manifest[key]==value for key,value in compiled.items()),'Runtime descriptor differs from verified manifest'
    evidence={'status':'passed','originalArchiveSha256':sha(archive),'originalFilesVerified':22,
              'reuploadByteIdentical':True if args.upload else None,'sourceFrameCount':16,
              'sourceFrameDurationsMs':[80]*16,'durationMs':1280,'sourceFps':12.5,
              'coordinatesVerified':358*267*16,'maximumColorSamplingOffsetPx':[1,1],'paletteColors':len(palette),
              'differentColorPixels':changed,'clusterSelectedPixels':clustered_changes,'method':'Independent PNG decode: every output color belongs to its own original aligned2x2 block; dominant cluster rule and native thin features; canonical exact nearest2x'}
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence))
    return 0


if __name__=='__main__':
    try:raise SystemExit(main())
    except (AssertionError,KeyError,ValueError,OSError,zipfile.BadZipFile,zlib.error) as error:
        print('Faithful pixel verification failed:',error,file=sys.stderr);raise SystemExit(1)
