#!/usr/bin/env python3
"""Independently verify source anchors, bounded pixel styling and HD presentation.

Uses only the standard library in CI. Source motion anchors are checked against
the immutable upload; estimated intermediate frames are reported separately.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile

from verify_faithful_pixel_scene import png_rgb, sha

ROOT = Path(__file__).resolve().parents[2]


def scale2x_rgb(pixels: bytes, width: int, height: int) -> bytes:
    """Independent five-neighbour reconstruction, using existing colours only."""
    out_width = width * 2
    output = bytearray(width * height * 12)
    for y in range(height):
        for x in range(width):
            def at(xx, yy):
                offset=(max(0,min(height-1,yy))*width+max(0,min(width-1,xx)))*3
                return pixels[offset:offset+3]
            center,north,west,east,south=at(x,y),at(x,y-1),at(x-1,y),at(x+1,y),at(x,y+1)
            colors=[center]*4
            if north!=south and west!=east:
                if west==north:colors[0]=west
                if north==east:colors[1]=east
                if west==south:colors[2]=west
                if south==east:colors[3]=east
            for index,color in enumerate(colors):
                offset=((y*2+index//2)*out_width+x*2+index%2)*3
                output[offset:offset+3]=color
    return bytes(output)


def nearest2x_rgb(pixels: bytes, width: int, height: int) -> bytes:
    rows=[]
    for y in range(height):
        row=pixels[y*width*3:(y+1)*width*3]
        doubled=b''.join(row[x:x+3]*2 for x in range(0,len(row),3))
        rows.extend((doubled,doubled))
    return b''.join(rows)


def original_inventory(source: Path, expected_sha: str) -> int:
    provenance=json.loads((source/'provenance.json').read_text())
    archive=(source/'source-project.zip').read_bytes()
    assert sha(archive)==provenance['archiveSha256']==expected_sha,'Immutable ZIP changed'
    inventory={item['path']:item for item in provenance['originalFiles']}
    with zipfile.ZipFile(source/'source-project.zip') as uploaded:
        assert uploaded.testzip() is None,'Source ZIP CRC failure'
        names=[]
        for entry in uploaded.infolist():
            if entry.is_dir():continue
            path=PurePosixPath(entry.filename)
            assert not path.is_absolute() and '..' not in path.parts,'Unsafe ZIP entry'
            relative=str(PurePosixPath(*path.parts[1:]))
            assert relative in inventory,'Unexpected source member'
            blob=uploaded.read(entry);expected=inventory[relative]
            assert blob==(source/'original'/relative).read_bytes(),'Original source file changed'
            assert len(blob)==expected['bytes'] and sha(blob)==expected['sha256']
            names.append(relative)
    assert sorted(names)==sorted(inventory) and len(names)==22,'Incomplete original source project'
    return len(names)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    base=ROOT/'public/assets/poetic-pixel'
    manifest=json.loads((base/'manifest.json').read_text())
    runtime=manifest.get('runtime',manifest)
    source=ROOT/'reference-projects/fuji-wind'
    originals=original_inventory(source,manifest['sourceArchiveSha256'])
    width,height=runtime['tileWidth'],runtime['tileHeight']
    count=runtime['frameCount'];columns=runtime['atlasColumns'];rows=runtime['atlasRows']
    assert (width,height)==(358,267),'Source coordinate resolution must remain native'
    assert count in (16,64) and count*runtime['frameDurationsMs'][0]==1280
    assert runtime['frameDurationsMs']==[1280/count]*count and runtime['durationMs']==1280
    assert runtime.get('sourceAnchorCount',16)==16 and columns*rows>=count
    assert (runtime['outputWidth'],runtime['outputHeight'])==(1432,1068)
    assert (runtime['canonicalWidth'],runtime['canonicalHeight'])==(1432,1068)
    assert width*columns<=8192 and height*rows<=8192
    for category in ('authoring','files'):
        for entry in manifest[category]:
            path=(ROOT/entry['file']).resolve()
            assert path.is_relative_to(ROOT),'Unsafe derivative path'
            data=path.read_bytes()
            assert len(data)==entry['bytes'] and sha(data)==entry['sha256'],'Stale derivative: '+entry['file']
    atlas_blob=(base/runtime['atlas']).read_bytes()
    assert sha(atlas_blob)==runtime['atlasSha256']
    aw,ah,atlas=png_rgb(atlas_blob)
    assert (aw,ah)==(width*columns,height*rows)

    def tile(index):
        x,y=index%columns*width,index//columns*height
        return b''.join(atlas[((y+dy)*aw+x)*3:((y+dy)*aw+x+width)*3] for dy in range(height))

    palette={tuple(color) for color in manifest['palette']}
    assert 37<len(palette)<255,'Use richer limited pixel ramps, not the source anime palette'
    mapping={tuple(item['source']):bytes(item['target']) for item in manifest['colorMapping']}
    assert len(mapping)==255 and all(tuple(color) in palette for color in mapping.values())
    anchors=manifest['sourceAnchors'];assert len(anchors)==16
    group=count//16;coordinates=0;native_retained=0;changed=0
    for index,entry in enumerate(anchors):
        assert entry['index']==index and entry['derivedFrameIndex']==index*group
        path=source/f'original/frames/frame_{index:03}.png'
        assert (ROOT/entry['sourceFile']).resolve()==path.resolve(),'Original anchor order changed'
        blob=path.read_bytes();assert sha(blob)==entry['sourceSha256']
        ow,oh,original=png_rgb(blob);assert (ow,oh)==(width,height)
        if 'sourcePixelSha256' in entry:assert sha(original)==entry['sourcePixelSha256']
        styled=tile(index*group)
        expected_hash=entry.get('nativeStylePixelSha256',entry.get('outputPixelSha256'))
        assert expected_hash is not None and sha(styled)==expected_hash,'Styled source anchor changed'
        mapped=b''.join(mapping[tuple(original[p:p+3])] for p in range(0,len(original),3))
        for y in range(height):
            for x in range(width):
                p=(y*width+x)*3;color=styled[p:p+3];own=mapped[p:p+3]
                block={mapped[(yy*width+xx)*3:(yy*width+xx)*3+3]
                       for yy in range(y//2*2,min(y//2*2+2,height))
                       for xx in range(x//2*2,min(x//2*2+2,width))}
                assert color in block,'Anchor colour sampled outside its own original 2x2 block'
                protected=(115<=x<249 and 82<=y<111) or (157<=x<210 and 137<=y<153)
                if protected:assert color==own,'Source eye/mouth detail changed'
                coordinates+=1;native_retained+=color==own;changed+=color!=original[p:p+3]
    frames=manifest.get('frames',[])
    if frames:
        assert len(frames)==count
        for index,entry in enumerate(frames):
            assert entry['index']==index and entry['durationMs']==runtime['frameDurationsMs'][index]
            assert sha(tile(index))==entry['outputPixelSha256'],'Derived frame order or pixels changed'
    canonical_blob=(base/runtime['canonical']).read_bytes()
    assert sha(canonical_blob)==runtime['canonicalSha256']
    cw,ch,canonical=png_rgb(canonical_blob)
    assert (cw,ch)==(1432,1068)
    hd=scale2x_rgb(tile(0),width,height)
    expected=nearest2x_rgb(hd,width*2,height*2)
    assert canonical==expected,'Canonical differs from source-colour Scale2x followed by nearest2x'
    boot=manifest['boot'];video=(base/boot['file']).read_bytes()
    assert len(video)==boot['bytes'] and sha(video)==boot['sha256']
    assert (boot['width'],boot['height'])==(716,534) and boot['durationMs']==1280
    assert b'ftyp' in video[:32] and video.index(b'moov')<video.index(b'mdat'),'Preview must permit progressive media decoding'
    compiled=(ROOT/'src/features/poeticPixel/assets.ts').read_text()
    descriptor=json.JSONDecoder().raw_decode(compiled[compiled.index('{'):])[0]
    # Descriptor schema is checked against the corresponding published fields.
    for key,value in descriptor.items():
        if key in runtime:assert runtime[key]==value,'Compiled descriptor mismatch: '+key
        elif key in manifest:assert manifest[key]==value,'Compiled presentation mismatch: '+key
    evidence={'status':'passed','originalFilesVerified':originals,'sourceArchiveSha256':manifest['sourceArchiveSha256'],
              'sourceAnchors':16,'originalFrameDurationMs':80,'periodMs':1280,'playbackFrames':count,
              'playbackFrameDurationMs':1280/count,'intermediateFramesEstimated':count>16,
              'coordinatesVerified':coordinates,'maximumStylingNeighbourhoodPx':[2,2],
              'paletteColors':len(palette),'nativeMappedPixelsRetained':native_retained,'changedSourceColours':changed,
              'sourceCoordinateDimensions':[width,height],'outputDimensions':[cw,ch],
              'canonicalReconstruction':'Source-colour-only Scale2x once, then exact nearest2x; does not invent source detail',
              'bootBytes':len(video)}
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence))
    return 0


if __name__=='__main__':
    try:raise SystemExit(main())
    except (AssertionError,KeyError,ValueError,OSError,zipfile.BadZipFile) as error:
        print('Poetic pixel verification failed:',error,file=sys.stderr);raise SystemExit(1)
