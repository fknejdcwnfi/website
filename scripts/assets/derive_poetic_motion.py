#!/usr/bin/env python3
"""Estimate source-only 50 fps motion while retaining every original 80 ms anchor.

This reads the uploaded project as data and never executes its render.py. It
adds three estimated frames between each original pair, using the original
source images rather than a generated style master. Runtime receives images,
not flow fields. Thin-hair/occlusion estimates can still soften or distort detail;
50 fps is a derived sample rate, not newly recovered source information.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import numpy as np
from PIL import Image, ImageSequence
from derive_reference_motion import (
    EYE_FEATHER_PIXELS, EYE_REGIONS, NOSE_REGISTRATION_REGION,
    protect_eye_regions, register_head_positions,
)

ROOT = Path(__file__).resolve().parents[2]
FRAME_COUNT, FPS, DURATION_MS, PER_ANCHOR = 64, 50, 20, 4
FILTER = ('format=yuv444p,minterpolate=fps=50:mi_mode=mci:mc_mode=aobmc:'
          'me_mode=bidir:me=epzs:mb_size=8:search_param=32:vsbmc=1:scd=none,'
          'trim=start=1.28:end=2.56,setpts=PTS-STARTPTS')


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path: Path) -> dict:
    return {'file':str(path.relative_to(ROOT)), 'bytes':path.stat().st_size, 'sha256':sha(path)}


def derive(source: Path, output: Path) -> dict:
    if output.is_relative_to(source) or any(output.is_relative_to(ROOT/path) for path in
                                          ('reference-projects', 'assets/source', 'docs/reference')):
        raise ValueError('Derived frames must not overwrite an immutable source directory.')
    metadata = json.loads((source/'metadata.json').read_text())
    paths = [source/'frames'/f'frame_{index:03}.png' for index in range(16)]
    assert metadata['frame_durations_ms'] == [80]*16
    images = [Image.open(path).convert('RGB') for path in paths]
    assert all(image.size == (358,267) for image in images)
    with Image.open(source/'original.gif') as gif:
        frames = [frame.convert('RGB').copy() for frame in ImageSequence.Iterator(gif)]
        durations = [frame.info.get('duration') for frame in ImageSequence.Iterator(gif)]
    assert len(frames) == 16 and durations == [80]*16
    assert all(left.tobytes() == right.tobytes() for left,right in zip(images,frames))
    head_positions = register_head_positions(images)
    output.mkdir(parents=True,exist_ok=True)
    raw_anchor_errors = []
    with tempfile.TemporaryDirectory(prefix='poetic-source-mci-') as temporary:
        scratch = Path(temporary)
        for index in range(48):
            shutil.copyfile(paths[index%16],scratch/f'input_{index:03}.png')
        subprocess.run(['ffmpeg','-y','-v','error','-framerate','25/2','-start_number','0',
                        '-i',str(scratch/'input_%03d.png'),'-vf',FILTER,
                        '-frames:v',str(FRAME_COUNT),'-fps_mode','passthrough',
                        str(scratch/'derived_%03d.png')],check=True)
        generated = sorted(scratch.glob('derived_*.png'))
        assert len(generated) == FRAME_COUNT
        for anchor,image in enumerate(images):
            actual = np.asarray(Image.open(generated[anchor*PER_ANCHOR]).convert('RGB')).astype(np.int16)
            raw_anchor_errors.append(float(np.mean(np.abs(actual-np.asarray(image).astype(np.int16)))))
        assert max(raw_anchor_errors) < 2, 'Motion interpolation shifted the source time origin.'
        for index,path in enumerate(generated):
            anchor,subframe = divmod(index,PER_ANCHOR)
            destination = output/f'frame_{index:03}.png'
            if subframe == 0:
                shutil.copyfile(paths[anchor],destination)
            else:
                phase = subframe/PER_ANCHOR
                displacement = tuple((head_positions[(anchor+1)%16][axis]-head_positions[anchor][axis])*phase
                                     for axis in range(2))
                protect_eye_regions(Image.open(path),images[anchor],displacement).save(destination)
    anchors = []
    for index,path in enumerate(paths):
        target = output/f'frame_{index*PER_ANCHOR:03}.png'
        assert target.read_bytes() == path.read_bytes(), 'An original source anchor changed.'
        anchors.append({'sourceIndex':index,'frame':index*PER_ANCHOR,'timeMs':index*80,
                        'source':record(path),'outputSha256':sha(target),'differentSourcePixels':0})
    arrays = [np.asarray(Image.open(output/f'frame_{index:03}.png').convert('RGB')).astype(np.int16)
              for index in range(FRAME_COUNT)]
    steps = [float(np.mean(np.abs(arrays[(i+1)%FRAME_COUNT]-array))) for i,array in enumerate(arrays)]
    originals = [np.asarray(image).astype(np.int16) for image in images]
    source_steps = [float(np.mean(np.abs(originals[(i+1)%16]-array))) for i,array in enumerate(originals)]
    report = {
        'version':1, 'motionSource':'source-timing-with-estimated-intermediates',
        'width':358,'height':267,'frameCount':FRAME_COUNT,'frameDurationsMs':[DURATION_MS]*FRAME_COUNT,
        'durationMs':1280,'loop':0,'samplingFps':FPS,'sourceFrameCount':16,
        'sourceFrameDurationsMs':[80]*16,'sourceFps':12.5,'framesPerAnchor':PER_ANCHOR,
        'sourceGif':record(source/'original.gif'),'sourceMetadata':record(source/'metadata.json'),
        'authoring':[record(Path(__file__).resolve()),record(ROOT/'scripts/assets/derive_reference_motion.py')],
        'method':'FFmpeg bidirectional source-image motion compensation; three actual source loops, middle loop selected; no style-master retargeting or runtime displacement fields.',
        'filter':FILTER,'ffmpegVersion':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],
        'anchors':anchors,'anchorRule':'Frame4*i at80*i ms is a byte-exact copy of original source frame i.',
        'rawFilterAnchorMeanRgbErrorBeforeExactCopy':raw_anchor_errors,
        'eyeProtection':{
            'sourceIndexRule':'floor(index/4); original80ms eye and blink states retained',
            'regionsXyxy':EYE_REGIONS,'featherPixels':EYE_FEATHER_PIXELS,
            'registrationRegionXyxy':NOSE_REGISTRATION_REGION,'sourceHeadOffsetsXy':head_positions,
            'rule':'Single original donor eye shape with estimated source-derived local head translation; outer4px skin feather only. Source anchors bypass this operation.',
        },
        'temporalDifference':{'sourceOrdinaryMeanRgb':float(np.mean(source_steps[:-1])),
                              'sourceSeamMeanRgb':source_steps[-1],
                              'derivedOrdinaryMeanRgb':float(np.mean(steps[:-1])),
                              'derivedSeamMeanRgb':steps[-1],'derivedMaximumMeanRgb':max(steps)},
        'frames':[{'index':index,'file':f'frame_{index:03}.png','durationMs':DURATION_MS,
                   'sourceIndex':index//PER_ANCHOR,'isOriginalAnchor':index%PER_ANCHOR==0,
                   'sha256':sha(output/f'frame_{index:03}.png')}
                  for index in range(FRAME_COUNT)],
        'limitations':['Derived50fps samples are estimates, not original frames or recovered high-resolution information.',
                       'Motion compensation can soften or distort thin hair, snow and occlusions; view the rendered pixel derivatives.',
                       'Original facial/background movement and its1280ms source loop remain authoritative; source blink shape changes stay at80ms boundaries.',
                       'Image sample rate does not measure real-world physical screen FPS.'],
    }
    (output/'motion.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=ROOT/'reference-projects/fuji-wind/original')
    parser.add_argument('--output',type=Path,default=ROOT/'work/poetic-motion/interpolated50')
    args = parser.parse_args()
    report = derive(args.source.resolve(),args.output.resolve())
    print(json.dumps({key:report[key] for key in ['frameCount','samplingFps','durationMs','temporalDifference']}))


if __name__ == '__main__':main()
