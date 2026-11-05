#!/usr/bin/env python3
"""Derive explicitly labelled MCI frames from the supplied GIF project.

The source project is read as data. Its render.py is never executed. Original
80ms anchors are copied byte-for-byte after interpolation, so no generated
intermediate can change an authored reference frame. This does not recover new
source information or establish that all estimated hair/occlusion is correct.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / 'reference-projects/fuji-wind/original'
DEFAULT_OUTPUT = ROOT / 'work/reference-scene/interpolated'
EYE_REGIONS = ((114, 75, 169, 118), (188, 74, 243, 116))
EYE_FEATHER_PIXELS = 4
DERIVED_FPS = 125
FRAME_DURATION_MS = 8
SAMPLES_PER_ANCHOR = 10
DERIVED_FRAMES = 160
NOSE_REGISTRATION_REGION = (166, 126, 184, 150)

BASELINE_FILTER = (f'format=yuv444p,minterpolate=fps={DERIVED_FPS}:mi_mode=mci:mc_mode=aobmc:'
                   'me_mode=bidir:me=epzs:mb_size=8:search_param=32:vsbmc=1:scd=none')


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def register_head_positions(images: list[Image.Image]) -> list[tuple[int, int]]:
    """Track source head translation using its unchanged nose outline, not the blink.

    The small source-specific search is performed once offline. A translated
    single donor eye stays registered with the face without blending two lashes
    or interpreting the missing closed-frame iris as a motion vector.
    """
    x0, y0, x1, y1 = NOSE_REGISTRATION_REGION
    arrays = [np.asarray(image.convert('RGB')).astype(np.int16) for image in images]
    template = arrays[0][y0:y1, x0:x1]
    offsets = []
    for array in arrays:
        candidates = [(float(np.mean(np.abs(array[y0 + dy:y1 + dy, x0 + dx:x1 + dx] - template))), dx, dy)
                      for dy in range(-8, 9) for dx in range(-8, 9)]
        _, dx, dy = min(candidates)
        offsets.append((dx, dy))
    return offsets


def protect_eye_regions(estimated: Image.Image, donor: Image.Image,
                        displacement: tuple[float, float] = (0, 0)) -> Image.Image:
    """Transport one original eye/eyelash shape; feather only its outer skin edge.

    Never dissolve between different eyes. The head's source-derived local
    translation is the only estimated motion here; the original blink states
    and source timestamps are retained. Exact anchors bypass this function.
    """
    result = np.asarray(estimated.convert('RGB')).copy()
    mask = np.zeros(result.shape[:2], dtype=np.uint8)
    for x0, y0, x1, y1 in EYE_REGIONS:
        yy, xx = np.mgrid[y0:y1, x0:x1]
        distance = np.minimum.reduce((xx - x0, x1 - 1 - xx, yy - y0, y1 - 1 - yy))
        mask[y0:y1, x0:x1] = np.rint(np.clip(distance / EYE_FEATHER_PIXELS, 0, 1) * 255).astype(np.uint8)
    dx, dy = displacement
    transform = (1, 0, -dx, 0, 1, -dy)
    # Offline subpixel transport is re-quantized by the shared pixel authoring
    # palette. Runtime remains nearest-neighbor; no display filtering is added.
    source = np.asarray(donor.convert('RGB').transform(donor.size, Image.Transform.AFFINE,
                                                      transform, Image.Resampling.BILINEAR))
    weight = np.asarray(Image.fromarray(mask).transform(donor.size, Image.Transform.AFFINE,
                                                       transform, Image.Resampling.BILINEAR))[..., None] / 255
    result = np.rint(source * weight + result * (1 - weight)).astype(np.uint8)
    return Image.fromarray(result)


def derive(source: Path, output: Path, review: Path | None = None, protect_eyes: bool = True) -> dict:
    paths = sorted((source / 'frames').glob('frame_*.png'))
    metadata = json.loads((source / 'metadata.json').read_text())
    durations = metadata['frame_durations_ms']
    if len(paths) != 16 or durations != [80] * 16:
        raise ValueError('This source-specific export requires the reviewed 16x80ms project.')
    images = [Image.open(path).convert('RGB') for path in paths]
    if any(image.size != (358, 267) for image in images):
        raise ValueError('Unexpected source dimensions.')
    with Image.open(source / 'original.gif') as gif:
        decoded = [frame.convert('RGB').copy() for frame in ImageSequence.Iterator(gif)]
        gif_durations = []
        for frame in ImageSequence.Iterator(gif):
            gif_durations.append(frame.info.get('duration'))
        if len(decoded) != 16 or gif_durations != durations:
            raise ValueError('Source GIF timing disagrees with the project manifest.')
        if any(not np.array_equal(np.asarray(a), np.asarray(b)) for a, b in zip(images, decoded)):
            raise ValueError('PNG anchors disagree with the original GIF.')
    head_positions = register_head_positions(images)
    output.mkdir(parents=True, exist_ok=True)
    filter_graph = BASELINE_FILTER + ',trim=start=1.28:end=2.56,setpts=PTS-STARTPTS'
    with tempfile.TemporaryDirectory(prefix='vermouth-source-mci-') as temp:
        scratch = Path(temp)
        # Three actual copies create continuous pre/post-roll around the middle
        # loop; no source paths or frames are modified.
        for index in range(48):
            shutil.copyfile(paths[index % 16], scratch / f'input_{index:03d}.png')
        command = ['ffmpeg', '-v', 'error', '-y', '-framerate', '25/2', '-start_number', '0',
                   '-i', str(scratch / 'input_%03d.png'), '-vf', filter_graph,
                   '-frames:v', str(DERIVED_FRAMES), '-fps_mode', 'passthrough', str(scratch / 'derived_%03d.png')]
        subprocess.run(command, check=True)
        generated = sorted(scratch.glob('derived_*.png'))
        if len(generated) != DERIVED_FRAMES:
            raise RuntimeError(f'Expected {DERIVED_FRAMES} derived frames; found {len(generated)}.')
        raw_anchor_difference = []
        for anchor, image in enumerate(images):
            rendered = np.asarray(Image.open(generated[anchor * SAMPLES_PER_ANCHOR]).convert('RGB')).astype(np.int16)
            original = np.asarray(image).astype(np.int16)
            raw_anchor_difference.append(float(np.mean(np.abs(rendered - original))))
        # These should be only the RGB/YUV round-trip differences at matching
        # timestamps. A large difference means the filter time origin is wrong.
        if max(raw_anchor_difference) > 2:
            raise RuntimeError(f'Interpolation timestamps shifted from source anchors: {raw_anchor_difference}')
        for index, path in enumerate(generated):
            destination = output / f'frame_{index:03d}.png'
            anchor, subframe = divmod(index, SAMPLES_PER_ANCHOR)
            if subframe == 0:
                shutil.copyfile(paths[anchor], destination)
            elif protect_eyes:
                next_anchor = (anchor + 1) % len(images)
                phase = subframe / SAMPLES_PER_ANCHOR
                displacement = tuple((head_positions[next_anchor][axis] - head_positions[anchor][axis]) * phase
                                     for axis in range(2))
                protect_eye_regions(Image.open(path), images[anchor], displacement).save(destination)
            else:
                shutil.copyfile(path, destination)
    anchors = []
    for anchor, path in enumerate(paths):
        derived = output / f'frame_{anchor * SAMPLES_PER_ANCHOR:03d}.png'
        if derived.read_bytes() != path.read_bytes():
            raise RuntimeError('An original source anchor changed.')
        anchors.append({'source_frame': anchor, 'derived_frame': anchor * SAMPLES_PER_ANCHOR,
                        'time_ms': anchor * 80, 'sha256': sha(path), 'rgb_mismatches': 0})
    arrays = [np.asarray(Image.open(output / f'frame_{i:03d}.png').convert('RGB')).astype(np.int16)
              for i in range(DERIVED_FRAMES)]
    adjacent = [float(np.mean(np.abs(arrays[(i + 1) % DERIVED_FRAMES] - arrays[i]))) for i in range(DERIVED_FRAMES)]
    original_steps = [float(np.mean(np.abs(np.asarray(images[(i + 1) % 16]).astype(np.int16)
                                                   - np.asarray(images[i]).astype(np.int16)))) for i in range(16)]
    report = {
        'version': 2, 'source_gif': str((source / 'original.gif').relative_to(ROOT)),
        'source_sha256': sha(source / 'original.gif'), 'source_width': 358, 'source_height': 267,
        'source_frames': 16, 'source_durations_ms': durations, 'period_ms': 1280,
        'derived_frames': DERIVED_FRAMES, 'frame_duration_ms': FRAME_DURATION_MS, 'sampling_fps': DERIVED_FPS,
        'motion_source': 'source-timing-with-estimated-intermediates',
        'eye_protection': {'enabled': protect_eyes,
                           'source_frame_rule': 'floor(index/10), keeping original80ms eye/blink states',
                           'regions_xyxy': EYE_REGIONS, 'feather_pixels': EYE_FEATHER_PIXELS,
                           'head_registration_region_xyxy': NOSE_REGISTRATION_REGION,
                           'source_head_offsets_xy': head_positions,
                           'rule': 'One source eye shape transported by linearly interpolated source head translation; outer4px skin edge feathered. No blend between different eye/eyelash shapes; exact anchors bypass transport.'},
        'method': 'FFmpeg bidirectional motion-compensated adaptive overlapping blocks; three source loops, middle loop selected. No cross-fade filter.',
        'filter': filter_graph, 'ffmpeg_version': subprocess.check_output(['ffmpeg', '-version'], text=True).splitlines()[0],
        'anchor_rule': 'Every tenth derived frame is an exact byte-for-byte copy of the original PNG; original 80ms timestamps and 1280ms cycle are unchanged.',
        'raw_filter_anchor_mean_rgb_error_before_exact_copy': raw_anchor_difference,
        'anchors': anchors,
        'source_ordinary_step_mean_rgb_difference': float(np.mean(original_steps[:-1])),
        'source_seam_mean_rgb_difference': original_steps[-1],
        'derived_ordinary_step_mean_rgb_difference': float(np.mean(adjacent[:-1])),
        'derived_seam_mean_rgb_difference': adjacent[-1],
        'derived_max_step_mean_rgb_difference': max(adjacent),
        'limitations': ['The GIF itself changes some facial/body/background pixels and has a larger final-to-first transition.',
                       'Intermediate frames are estimates, not newly recovered or original GIF frames.',
                       'MCI can distort thin hair, snow and occlusions; protected eye shapes/blink states retain source12.5fps semantics with estimated local head translation.',
                       '125fps encoded samples are not a physical display or real-time performance measurement.'],
        'files': [{'file': f'frame_{i:03d}.png', 'sha256': sha(output / f'frame_{i:03d}.png')}
                  for i in range(DERIVED_FRAMES)],
    }
    (output / 'timing.json').write_text(json.dumps(report, indent=2) + '\n')
    if review:
        review.mkdir(parents=True, exist_ok=True)
        (review / 'interpolation.json').write_text(json.dumps(report, indent=2) + '\n')
        # Analyze half-way samples and the wrap to make residual warping visible.
        indices = [0, 5, 10, 65, 70, 75, 80, 85, 90, 145, 150, 155]
        canvas = Image.new('RGB', (358 * 4, 287 * 3), '#f1f0e9')
        draw = ImageDraw.Draw(canvas)
        for slot, index in enumerate(indices):
            x, y = slot % 4 * 358, slot // 4 * 287
            draw.text((x + 5, y + 4), f'{index:03d} / {index * FRAME_DURATION_MS} ms' + (' anchor' if index % SAMPLES_PER_ANCHOR == 0 else ' estimated'), fill='#222222')
            canvas.paste(Image.open(output / f'frame_{index:03d}.png').convert('RGB'), (x, y + 20))
        canvas.save(review / 'intermediate-contact.png')
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--review', type=Path, default=ROOT / 'artifacts/crisp-circle/source-analysis')
    parser.add_argument('--protect-eyes', action=argparse.BooleanOptionalAction, default=True)
    args = parser.parse_args()
    result = derive(args.source.resolve(), args.output.resolve(), args.review.resolve(), protect_eyes=args.protect_eyes)
    print(json.dumps({key: result[key] for key in ['source_frames', 'derived_frames', 'period_ms', 'source_seam_mean_rgb_difference', 'derived_seam_mean_rgb_difference', 'derived_max_step_mean_rgb_difference']}))


if __name__ == '__main__':
    main()
