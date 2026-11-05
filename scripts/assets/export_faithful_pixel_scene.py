#!/usr/bin/env python3
"""Derive crisp pixel clusters directly from the owner's original 16 GIF frames.

No pose retargeting, new character, deformation, blur or frame interpolation is
performed. A shared fixed colour table and a bounded 2x2 native-pixel selection
are applied independently to the existing frames. Source timing is unchanged.
Requires Pillow and NumPy for offline authoring only; runtime loads two PNGs.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'reference-projects/fuji-wind/original'
OUT = ROOT / 'public/assets/faithful-pixel'
AUTHOR = ROOT / 'src/features/faithfulPixel/assets.ts'
WIDTH, HEIGHT = 358, 267
# Selected once from the complete 16-frame source sequence, not re-learned for
# each image. The last five are exact source-palette colours for sapphire/iris
# ramps and white glints, which occupy too little area for a global median cut.
# All frames share the same colour mapping and index ordering.
PALETTE = np.array([
    [247,221,206], [226,200,194], [226,190,177], [219,189,183],
    [206,188,199], [216,186,180], [214,183,174], [211,180,172],
    [203,177,173], [202,171,164], [200,159,155], [178,166,182],
    [177,145,150], [154,151,177], [122,142,187], [166,128,125],
    [149,124,130], [154,116,115], [137,116,124], [134,109,111],
    [108,126,172], [109,113,147], [90,116,168], [81,108,161],
    [130,102,102], [115,96,100], [95,92,115], [72,97,148],
    [97,79,84], [66,78,112], [72,64,79], [52,43,53],
    [33,58,99], [69,133,185], [108,170,216], [128,183,219], [254,251,236],
], dtype=np.int32)
LUMA_WEIGHTS = np.array([2126, 7152, 722], dtype=np.int32)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def record(path: Path) -> dict:
    data = path.read_bytes()
    return {'file': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': sha(data)}


def fine_features(mapped: np.ndarray) -> np.ndarray:
    """Keep existing eye, mouth and fine chain/blue-jewel samples at 1px.

    These masks select pixels from the SAME original frame; there is no fixed
    generated face, synthetic eyelid, or separate blink/physics clock.
    """
    yy, xx = np.mgrid[:HEIGHT, :WIDTH]
    protect = ((82 <= yy) & (yy < 111) & (115 <= xx) & (xx < 249))
    protect |= ((137 <= yy) & (yy < 153) & (157 <= xx) & (xx < 210))
    rgb = mapped.astype(np.int32)
    protect |= ((rgb[:, :, 2] > rgb[:, :, 0] + 20) &
                (rgb[:, :, 1] > rgb[:, :, 0] + 8) &
                (yy > 111) & (xx > 105) & (xx < 263))
    # Narrow dark chain bands follow the source necklace. Broad skin, face and
    # hair are intentionally not exempted from the 2px cluster treatment.
    left_chain = np.abs(xx - (130 + (yy - 184) * 5 / 7)) < 8
    right_chain = np.abs(xx - (234 - (yy - 184) * 5 / 7)) < 8
    dark = (rgb @ LUMA_WEIGHTS) < 115 * 10000
    protect |= (yy >= 184) & (yy < 264) & (left_chain | right_chain) & dark
    return protect


def pixel_clusters(mapped: np.ndarray) -> np.ndarray:
    """Replace each aligned 2x2 block with one of its own mapped colours.

    The modal colour wins. Ties choose lowest integer luminance, then RGB order.
    Every pixel samples only its own 2x2 block (at most 1 native pixel per axis).
    Explicit fine-feature pixels retain their own mapped source sample.
    """
    result = mapped.copy()
    for y in range(0, HEIGHT, 2):
        for x in range(0, WIDTH, 2):
            block = mapped[y:y + 2, x:x + 2]
            colors, counts = np.unique(block.reshape(-1, 3), axis=0, return_counts=True)
            choices = colors[counts == counts.max()].astype(np.int32)
            chosen = choices[(choices @ LUMA_WEIGHTS).argmin()]
            result[y:y + 2, x:x + 2] = chosen
    protect = fine_features(mapped)
    result[protect] = mapped[protect]
    return result


def save_exact(path: Path, rgb: np.ndarray) -> None:
    """Lossless RGB PNG: no second palette quantization or colour-cache changes."""
    Image.fromarray(rgb.astype(np.uint8)).save(path, format='PNG', optimize=True)
    assert Image.open(path).convert('RGB').tobytes() == rgb.astype(np.uint8).tobytes()


def main() -> None:
    metadata = json.loads((SOURCE / 'metadata.json').read_text())
    durations = metadata['frame_durations_ms']
    assert durations == [80] * 16, 'A source change needs an explicit timing review.'
    inputs = [SOURCE / 'frames' / f'frame_{i:03d}.png' for i in range(16)]
    original = [np.asarray(Image.open(path).convert('RGB')) for path in inputs]
    assert all(frame.shape == (HEIGHT, WIDTH, 3) for frame in original)
    source_colors = np.unique(np.concatenate([frame.reshape(-1, 3) for frame in original]), axis=0)
    differences = source_colors.astype(np.int32)[:, None, :] - PALETTE[None, :, :]
    nearest = np.square(differences).sum(axis=2).argmin(axis=1)
    targets = PALETTE[nearest].astype(np.uint8)
    # RGB packed keys are sorted by np.unique's lexicographic order.
    keys = source_colors.astype(np.int32) @ np.array([65536, 256, 1])
    mapped = [targets[np.searchsorted(keys, frame.astype(np.int32) @ np.array([65536, 256, 1]))]
              for frame in original]
    converted = [pixel_clusters(frame) for frame in mapped]
    OUT.mkdir(parents=True, exist_ok=True)
    atlas = np.zeros((HEIGHT * 4, WIDTH * 4, 3), dtype=np.uint8)
    for index, frame in enumerate(converted):
        x, y = index % 4 * WIDTH, index // 4 * HEIGHT
        atlas[y:y + HEIGHT, x:x + WIDTH] = frame
    save_exact(OUT / 'atlas.png', atlas)
    canonical = np.repeat(np.repeat(converted[0], 2, axis=0), 2, axis=1)
    save_exact(OUT / 'canonical.png', canonical)
    archive = ROOT / 'reference-projects/fuji-wind/source-project.zip'
    descriptor = {
        'version': 1, 'motionSource': 'original-source-frames',
        'width': WIDTH, 'height': HEIGHT, 'tileWidth': WIDTH, 'tileHeight': HEIGHT,
        'sourceWidth': WIDTH, 'sourceHeight': HEIGHT,
        'frameCount': 16, 'frameDurationsMs': durations, 'durationMs': sum(durations),
        'loop': 0, 'atlasColumns': 4, 'atlasRows': 4,
        'atlas': 'atlas.png', 'atlasSha256': sha((OUT / 'atlas.png').read_bytes()),
        'atlasWidth': WIDTH * 4, 'atlasHeight': HEIGHT * 4,
        'canonical': 'canonical.png', 'canonicalSha256': sha((OUT / 'canonical.png').read_bytes()),
        'canonicalWidth': WIDTH * 2, 'canonicalHeight': HEIGHT * 2,
        'sourceArchiveSha256': sha(archive.read_bytes()),
    }
    manifest = {
        **descriptor,
        'description': 'Direct source-frame pixel clusters; no pose retargeting or invented motion.',
        'sourceArchive': record(archive),
        'verifiedReupload': {'fileName': '富士山風雪動畫_可編輯源文件.zip',
                            'sha256': sha(archive.read_bytes()), 'bytes': archive.stat().st_size,
                            'matchesPreservedArchive': True},
        'algorithm': {
            'name': 'shared-palette-native-2x2-dominant-clusters', 'version': 1,
            'paletteSize': len(PALETTE), 'paletteSource': 'fixed-once-from-complete-source-sequence',
            'colorDistance': 'squared-euclidean-rgb; palette-index tie-break',
            'nativeGrid': [WIDTH, HEIGHT], 'clusterSize': [2, 2], 'clusterOrigin': [0, 0],
            'clusterRepresentative': 'most-frequent-mapped-colour; lowest-integer-luminance tie-break; RGB-order tie-break',
            'luminanceWeights': LUMA_WEIGHTS.tolist(),
            'maxSelectionDistancePerAxisPx': 1,
            'fineFeatures': {
                'eyesRect': [115, 82, 249, 111], 'mouthRect': [157, 137, 210, 153],
                'blueJewel': 'B > R+20 && G > R+8 && y>111 && 105<x<263, using mapped RGB',
                'chain': '184<=y<264 && luminance<1150000 && (abs(x-(130+(y-184)*5/7))<8 || abs(x-(234-(y-184)*5/7))<8)',
                'sample': 'own-original-frame-pixel-after-shared-palette',
            },
            'dithering': False, 'blur': False, 'spatialWarp': False, 'resamplingBeforeStyling': False,
            'frameInterpolation': False, 'runtimeUpscale': 'nearest-neighbour-2x',
            'note': 'Pixel clustering changes local edge samples by at most one native pixel per axis; source animation order, timing and poses are retained. This is Minecraft-inspired 2D pixel art, not a native Minecraft texture or 3D simulation.',
        },
        'palette': PALETTE.tolist(),
        'colorMapping': [{'source': color.tolist(), 'target': target.tolist()}
                         for color, target in zip(source_colors, targets)],
        'framePixelFormat': 'RGB8',
        'frames': [{'index': i, 'durationMs': durations[i],
                    'sourceFile': str(path.relative_to(ROOT)),
                    'sourceSha256': sha(path.read_bytes()),
                    'sourcePixelSha256': sha(original[i].tobytes()),
                    'outputPixelSha256': sha(converted[i].tobytes())}
                   for i, path in enumerate(inputs)],
        'authoring': [record(Path(__file__).resolve())],
        'files': [record(OUT / 'atlas.png'), record(OUT / 'canonical.png')],
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    AUTHOR.parent.mkdir(parents=True, exist_ok=True)
    AUTHOR.write_text('// Generated by scripts/assets/export_faithful_pixel_scene.py; do not edit.\n'
                      'export const faithfulPixelAssets = ' + json.dumps(descriptor, indent=2) + ' as const\n')
    print(json.dumps({'frames': len(converted), 'sourcePeriodMs': sum(durations),
                      'atlasBytes': (OUT / 'atlas.png').stat().st_size,
                      'canonicalBytes': (OUT / 'canonical.png').stat().st_size,
                      'manifest': str((OUT / 'manifest.json').relative_to(ROOT))}))


if __name__ == '__main__':
    main()
