#!/usr/bin/env python3
"""One Minecraft pixel-art master driven by source poses; original files stay immutable.

Repainted RGB is deliberately different from the reference. Source timing and
pose fields are recorded separately from the new artwork and video encoding.
"""
from __future__ import annotations
import argparse, hashlib, json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scale_pixel_art import scale2x

ROOT = Path(__file__).resolve().parents[2]
NATIVE = (358, 267)
OUTPUT = ROOT / 'public/assets/reference-scene'
MASTER = ROOT / 'assets/generated/minecraft-style/style-master.png'
CLOSED = ROOT / 'assets/generated/minecraft-style/closed-eye-master.png'
# Only the eyelids are taken from the closed-eye edit. The rest of the face,
# hair, shoulders and scene always come from the same open canonical master.
EYE_REGIONS = [(121, 83, 171, 111), (191, 81, 240, 111)]

def record(path: Path) -> dict:
    data = path.read_bytes()
    return {'file': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def closure_at(time: int) -> float:
    position = (time % 1280) / 80
    if 6 <= position < 7:
        t = position - 6
    elif 7 <= position < 8:
        return 1.
    elif 8 <= position < 9:
        t = 9 - position
    else:
        return 0.
    return t * t * (3 - 2 * t)

def write_indexed(path: Path, array: np.ndarray, palette: Image.Image) -> Image.Image:
    image = Image.fromarray(array.astype(np.uint8), 'RGB').quantize(palette=palette, dither=Image.Dither.NONE)
    image.save(path, optimize=True)
    return image

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--flows', type=Path, required=True)
    parser.add_argument('--review', type=Path, default=ROOT/'artifacts/scenic-snow')
    args = parser.parse_args()
    flow_dir = args.flows.resolve()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    args.review.mkdir(parents=True, exist_ok=True)
    opened = np.asarray(Image.open(MASTER).convert('RGB').resize(NATIVE, Image.Resampling.NEAREST))
    closed = np.asarray(Image.open(CLOSED).convert('RGB').resize(NATIVE, Image.Resampling.NEAREST))
    # Learn one palette once. Re-quantizing individual frames would make colors flicker.
    pool = np.concatenate([opened, closed], axis=0)
    palette = Image.fromarray(pool).quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    # Palette conversion happens ONCE. Move stable indices thereafter: Pillow's
    # per-image palette cache can otherwise map equal RGB differently each frame.
    indices = np.asarray(palette)
    opened = indices[:267].copy()
    closed = indices[267:].copy()
    yy, xx = np.indices((NATIVE[1], NATIVE[0]))
    fields, field_records = [], []
    for i in range(16):
        path = flow_dir / f'flow_{i:03d}.npz'
        data = np.load(path)
        field = data['flow_quantized'].astype(np.float32)/8 if 'flow_quantized' in data.files else data['flow'] if 'flow' in data.files else np.stack([data['dx'], data['dy']], axis=-1)
        if field.shape != (267, 358, 2) or not np.isfinite(field).all():
            raise ValueError('Invalid source pose displacement field: '+str(path))
        fields.append(field.astype(np.float32))
        field_records.append(record(path))
    assert not np.any(fields[0]), 'Canonical pose must have zero source displacement.'
    frames, checksums, closure = [], [], []
    for i in range(160):
        anchor, fraction = divmod(i, 10)
        field = fields[anchor] * (1 - fraction/10) + fields[(anchor+1)%16] * (fraction/10)
        donor = opened.copy()
        amount = closure_at(i*8)
        for x0,y0,x1,y1 in EYE_REGIONS:
            # A discrete eyelid wipe, never a dissolve between two whole faces.
            rows = round((y1-y0)*amount)
            if rows:
                donor[y0:y0+rows,x0:x1] = closed[y0:y0+rows,x0:x1]
        sx = np.clip(np.rint(xx+field[...,0]).astype(np.int32),0,357)
        sy = np.clip(np.rint(yy+field[...,1]).astype(np.int32),0,266)
        image = Image.fromarray(donor[sy,sx], 'P')
        image.putpalette(palette.getpalette())
        frames.append(image)
        raw = np.asarray(image.convert('RGBA')).reshape(-1)
        checksum = 2166136261
        for value in raw:
            checksum = ((checksum ^ int(value))*16777619)&0xffffffff
        checksums.append(checksum)
        closure.append(amount)
    palette_values = frames[0].getpalette()
    descriptors = {}
    for prefix, indices, columns in [('pixel-source',list(range(0,160,10)),4),('pixel-smooth',list(range(160)),16)]:
        rows = (len(indices)+columns-1)//columns
        atlas = Image.new('P',(358*columns,267*rows))
        atlas.putpalette(palette_values)
        for slot,index in enumerate(indices):
            atlas.paste(frames[index],((slot%columns)*358,(slot//columns)*267))
        atlas_path = OUTPUT/f'{prefix}-atlas.png'
        atlas.save(atlas_path,optimize=True)
        item = record(atlas_path)
        descriptor = {'version':1,'motionSource':'source-timing'if prefix=='pixel-source'else'motion-compensated',
            'width':358,'height':267,'sourceWidth':358,'sourceHeight':267,'tileWidth':358,'tileHeight':267,
            'frameCount':len(indices),'frameDurationsMs':[80 if prefix=='pixel-source' else 8]*len(indices),
            'durationMs':1280,'loop':0,'atlasColumns':columns,'atlasRows':rows,
            'atlas':atlas_path.name,'atlasSha256':item['sha256'],'atlasBytes':item['bytes'],
            'atlasWidth':atlas.width,'atlasHeight':atlas.height}
        manifest = descriptor|{'sourceAnchorCount':16,'frameChecksums':[checksums[i]for i in indices],
            'eyelidClosure':[closure[i]for i in indices], 'palette':palette_values,
            'artwork':'One Minecraft-inspired pixel master retargeted by regularized source pose fields; no independent generated animation faces.'}
        (OUTPUT/f'{prefix}-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        descriptors[prefix]=descriptor
    native = frames[0].convert('RGB')
    canonical = scale2x(native)
    # Encode exact existing colors explicitly; Pillow palette quantization is
    # approximate even when every RGB already occurs in the supplied palette.
    values = np.asarray(canonical.convert('RGB'))
    colors = sorted(set(map(tuple, values.reshape(-1,3))))
    lookup = {color:i for i,color in enumerate(colors)}
    raw_indices = bytes(lookup[tuple(color)]for color in values.reshape(-1,3))
    hd = Image.frombytes('P',canonical.size,raw_indices)
    hd.putpalette([int(channel)for color in colors for channel in color]+[0]*(768-len(colors)*3))
    hd.save(OUTPUT/'canonical-hd.png',optimize=True)
    assert np.array_equal(np.asarray(Image.open(OUTPUT/'canonical-hd.png').convert('RGB')),values)
    command = ['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size','716x534',
        '-framerate','125','-i','pipe:0','-an','-c:v','libx264','-preset','slow','-tune','animation',
        '-crf','26','-pix_fmt','yuv420p','-r','125','-fps_mode','cfr','-frames:v','160','-g','160','-movflags','+faststart',str(OUTPUT/'boot.mp4')]
    process = subprocess.Popen(command,stdin=subprocess.PIPE)
    try:
        for frame in frames:
            process.stdin.write(scale2x(frame.convert('RGB')).tobytes())
        process.stdin.close()
        if process.wait():
            raise RuntimeError('Progressive video encoding failed.')
    finally:
        if process.poll() is None: process.kill()
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
        '-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',str(OUTPUT/'boot.mp4')]))['streams'][0]
    assert probe['r_frame_rate']=='125/1' and int(probe['nb_frames'])==160 and abs(float(probe['duration'])-1.28)<.0001,probe
    def asset(name,width,height):
        return {'file':name,'sha256':record(OUTPUT/name)['sha256'],'width':width,'height':height}
    presentation = {'canonical':asset('canonical-hd.png',716,534),
        'boot':asset('boot.mp4',716,534)|{'durationMs':1280},'scenery':asset('scenery.webp',1536,1024)}
    metadata={'version':2,'assets':presentation,'width':716,'height':534,'nativeWidth':358,'nativeHeight':267,
        'sourceFrames':16,'derivedFrames':160,'durationMs':1280,'frameDurationsMs':[8]*160,
        'artworkMethod':'Single Minecraft pixel-art master, source pose displacement fields, local canonical eyelid-only edit, one fixed shared palette, Scale2x output.',
        'limitations':['New artwork RGB is intentionally different from the anime source.',
          'Regularized pose retargeting and intermediate fields are estimates; occluded/newly exposed strands may differ from reference.',
          '125fps is the encoded sample rate, not a physical display measurement.'],
        'eyelidRegions':EYE_REGIONS,'eyelidClosure':closure,
        'sources':[record(MASTER),record(CLOSED),record(ROOT/'reference-projects/fuji-wind/original/original.gif'),
            record(ROOT/'assets/generated/fuji-scenery/style-scenery.png'),
            record(ROOT/'assets/generated/minecraft-style/provenance.json'),
            record(ROOT/'assets/generated/minecraft-style/closed-eye-provenance.json'),
            record(ROOT/'assets/generated/fuji-scenery/provenance.json')],
        'poseFields':field_records,'authoring':[record(Path(__file__)),record(ROOT/'scripts/assets/scale_pixel_art.py'),
            record(ROOT/'scripts/assets/retarget_pixel_motion.py')],
        'files':[record(OUTPUT/name)for name in ['canonical-hd.png','boot.mp4','scenery.webp',
            'pixel-source-atlas.png','pixel-smooth-atlas.png','pixel-source-manifest.json','pixel-smooth-manifest.json']],
        'video':probe,'videoEncoding':{'codec':'H264 yuv420p','crf':26,'frames':160,'fps':125,'progressiveFastStart':True,'purpose':'Compact first-motion presentation; lossless styled atlas replaces it at the same source phase'}}
    (OUTPUT/'presentation-manifest.json').write_text(json.dumps(metadata,indent=2)+'\n')
    (ROOT/'src/features/referenceScene/presentationAssets.ts').write_text('// Generated by scripts/assets/export_scene_presentation.py; do not edit.\nexport const presentationAssets = '+json.dumps(presentation,indent=2)+' as const\n')
    (ROOT/'src/features/referenceScene/pixelAssets.ts').write_text('// Generated by scripts/assets/export_scene_presentation.py; do not edit.\n'+''.join('export const '+name+' = '+json.dumps(descriptors[prefix],indent=2)+' as const\n'for prefix,name in [('pixel-source','sourceAssetManifest'),('pixel-smooth','smoothAssetManifest')]))
    for i in range(16):
        scale2x(frames[i*10].convert('RGB')).save(args.review/f'styled-anchor-{i:02d}.png')
    print(json.dumps({'status':'exported','frames':160,'width':716,'height':534,'durationMs':1280,
        'videoBytes':(OUTPUT/'boot.mp4').stat().st_size,'paletteColors':256}))

if __name__=='__main__': main()
