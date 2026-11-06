#!/usr/bin/env python3
"""Author a detailed pixel scene from the immutable original animation.

A shared exact-source palette, native contour samples and small material clusters
retain the original composition. Output enlargement is source-color-only Scale2x
applied twice followed by nearest2, not newly recovered source detail. Intermediate frames, when
selected, are recorded offline estimates; all original source anchors remain exact.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

import numpy as np
from PIL import Image
from scale_pixel_art import scale2x

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'reference-projects/fuji-wind/original'
OUT = ROOT / 'public/assets/poetic-pixel'
AUTHOR = ROOT / 'src/features/poeticPixel/assets.ts'
WIDTH, HEIGHT = 358, 267
# Fixed once from all16 original frames: retain the existing72 source medoids,
# then24 exact-source RGB selected by weighted error reduction for the visible
# background and hair. The first five pin exact iris/sapphire/glint RGB.
# No intermediate frame trains the palette; there is no frame-local adaptation.
PALETTE = np.array([
    [33, 58, 99], [69, 133, 185], [108, 170, 216], [128, 183, 219], [254, 251, 236], [216, 186, 180],
    [125, 103, 105], [170, 140, 136], [12, 10, 15], [87, 67, 71], [63, 88, 140], [115, 121, 161],
    [169, 162, 188], [246, 219, 208], [197, 165, 155], [80, 109, 164], [49, 35, 41], [155, 118, 117],
    [132, 150, 192], [108, 86, 88], [97, 130, 185], [54, 67, 101], [93, 99, 131], [145, 132, 167],
    [202, 176, 169], [229, 202, 195], [182, 143, 168], [134, 120, 131], [67, 54, 61], [187, 177, 197],
    [84, 83, 98], [94, 108, 151], [136, 111, 112], [191, 151, 139], [133, 90, 83], [35, 27, 35],
    [122, 134, 176], [101, 122, 170], [173, 127, 120], [164, 169, 199], [234, 192, 168], [113, 140, 191],
    [143, 102, 95], [38, 48, 74], [109, 97, 105], [120, 117, 145], [138, 129, 148], [246, 213, 191],
    [159, 125, 154], [85, 90, 118], [200, 161, 181], [108, 107, 135], [210, 209, 221], [174, 153, 155],
    [69, 64, 77], [108, 66, 62], [63, 79, 118], [70, 86, 125], [157, 163, 196], [160, 133, 131],
    [162, 138, 167], [76, 100, 151], [206, 170, 157], [222, 194, 188], [252, 234, 218], [77, 74, 87],
    [128, 127, 163], [87, 116, 170], [123, 112, 125], [89, 75, 81], [105, 114, 155], [95, 53, 50],
    [211, 182, 174], [148, 123, 123], [118, 97, 99], [200, 171, 163], [182, 168, 189], [199, 181, 196],
    [181, 144, 136], [129, 109, 112], [138, 116, 118], [250, 227, 211], [83, 106, 156], [109, 92, 96],
    [98, 84, 91], [95, 90, 104], [112, 127, 172], [219, 189, 183], [145, 110, 107], [157, 155, 186],
    [129, 98, 96], [189, 156, 148], [135, 105, 104], [96, 115, 163], [84, 100, 144], [209, 177, 166],
], dtype=np.int32)
LUMA_WEIGHTS = np.array([2126, 7152, 722], dtype=np.int32)
CONTOUR_THRESHOLD = 50


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def record(path: Path) -> dict:
    data = path.read_bytes()
    return {'file': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': sha(data)}


def fine_features(mapped: np.ndarray) -> np.ndarray:
    yy, xx = np.mgrid[:HEIGHT, :WIDTH]
    rgb = mapped.astype(np.int32)
    protect = ((82 <= yy) & (yy < 111) & (115 <= xx) & (xx < 249))
    protect |= ((137 <= yy) & (yy < 153) & (157 <= xx) & (xx < 210))
    protect |= ((rgb[:, :, 2] > rgb[:, :, 0] + 20) &
                (rgb[:, :, 1] > rgb[:, :, 0] + 8) &
                (yy > 111) & (xx > 105) & (xx < 263))
    left_chain = np.abs(xx - (130 + (yy - 184) * 5 / 7)) < 8
    right_chain = np.abs(xx - (234 - (yy - 184) * 5 / 7)) < 8
    dark = (rgb @ LUMA_WEIGHTS) < 115 * 10000
    protect |= (yy >= 184) & (yy < 264) & (left_chain | right_chain) & dark
    return protect


def detail_mask(mapped: np.ndarray) -> np.ndarray:
    """Retain native high-contrast hair, blossom, mountain and jewelry contours."""
    center = mapped.astype(np.int32)
    pad = np.pad(center, ((1, 1), (1, 1), (0, 0)), mode='edge')
    neighbors = [pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]]
    contrast = np.maximum.reduce([np.max(np.abs(center - neighbor), axis=2) for neighbor in neighbors])
    return (contrast >= CONTOUR_THRESHOLD) | fine_features(mapped)


def pixel_clusters(mapped: np.ndarray) -> np.ndarray:
    """Bounded2x2 representative material colors with native fine contours.

    Candidate order does not bias the result: modal count, then integer luminance,
    then RGB lexicographic order select one existing color from the same block.
    """
    padded = np.pad(mapped, ((0, HEIGHT % 2), (0, WIDTH % 2), (0, 0)), mode='edge')
    blocks = np.stack([padded[::2, ::2], padded[::2, 1::2],
                       padded[1::2, ::2], padded[1::2, 1::2]], axis=2).astype(np.int32)
    same = np.all(blocks[:, :, :, None, :] == blocks[:, :, None, :, :], axis=4)
    counts = same.sum(axis=3)
    eligible = counts == counts.max(axis=2, keepdims=True)
    luminance = blocks @ LUMA_WEIGHTS
    best_luminance = np.where(eligible, luminance, np.iinfo(np.int32).max).min(axis=2, keepdims=True)
    eligible &= luminance == best_luminance
    packed = blocks @ np.array([65536, 256, 1])
    choice = np.where(eligible, packed, 16777216).argmin(axis=2)
    yy, xx = np.indices(choice.shape)
    selected = blocks[yy, xx, choice].astype(np.uint8)
    result = np.repeat(np.repeat(selected, 2, axis=0), 2, axis=1)[:HEIGHT, :WIDTH]
    protect = detail_mask(mapped)
    result[protect] = mapped[protect]
    return result


class ColorMapper:
    """One cached fixed RGB mapping for anchors and all estimated frames."""
    def __init__(self) -> None:
        self.lookup = np.full(1 << 24, 255, dtype=np.uint8)

    def __call__(self, frame: np.ndarray) -> np.ndarray:
        keys = frame.astype(np.int32) @ np.array([65536, 256, 1])
        distinct = np.unique(keys)
        unknown = distinct[self.lookup[distinct] == 255]
        for start in range(0, len(unknown), 4096):
            batch = unknown[start:start + 4096]
            colors = np.stack([batch >> 16, (batch >> 8) & 255, batch & 255], axis=1)
            distances = np.square(colors[:, None, :] - PALETTE[None, :, :]).sum(axis=2)
            self.lookup[batch] = distances.argmin(axis=1).astype(np.uint8)
        return PALETTE[self.lookup[keys]].astype(np.uint8)


def save_exact(path: Path, rgb: np.ndarray) -> None:
    # Store explicit indices into the SAME fixed palette. Pillow's quantize()
    # uses a reduced-color cache and can alter already-known RGB samples; it is
    # deliberately not involved in this lossless storage-only optimization.
    colors = PALETTE.astype(np.uint8)
    packed = colors.astype(np.uint32) @ np.array([65536, 256, 1], dtype=np.uint32)
    order = np.argsort(packed)
    sorted_colors = packed[order]
    keys = rgb.astype(np.uint32) @ np.array([65536, 256, 1], dtype=np.uint32)
    positions = np.searchsorted(sorted_colors, keys)
    assert np.all(positions < len(sorted_colors)) and np.array_equal(sorted_colors[positions], keys)
    indices = order[positions].astype(np.uint8)
    image = Image.frombytes('P', (rgb.shape[1], rgb.shape[0]), indices.tobytes())
    image.putpalette(colors.flatten().tolist() + [0] * (768 - colors.size))
    image.save(path, format='PNG', optimize=True, bits=8)
    assert Image.open(path).convert('RGB').tobytes() == rgb.astype(np.uint8).tobytes()


def pack_atlas(frames: list[np.ndarray], columns: int) -> np.ndarray:
    rows = (len(frames) + columns - 1) // columns
    atlas = np.zeros((HEIGHT * rows, WIDTH * columns, 3), dtype=np.uint8)
    for index, frame in enumerate(frames):
        x, y = index % columns * WIDTH, index // columns * HEIGHT
        atlas[y:y + HEIGHT, x:x + WIDTH] = frame
    return atlas


def hd_frame(frame: np.ndarray) -> np.ndarray:
    reconstructed = np.asarray(scale2x(scale2x(Image.fromarray(frame))).convert('RGB'))
    return np.repeat(np.repeat(reconstructed, 2, axis=0), 2, axis=1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--motion-dir', type=Path, default=ROOT / 'work/poetic-motion/interpolated50')
    parser.add_argument('--source-only', action='store_true', help='Explicitly export original16-frame cadence without estimated interframes')
    args = parser.parse_args()
    source_paths = [SOURCE / 'frames' / f'frame_{index:03}.png' for index in range(16)]
    originals = [np.asarray(Image.open(path).convert('RGB')) for path in source_paths]
    assert all(frame.shape == (HEIGHT, WIDTH, 3) for frame in originals)
    source_colors = np.unique(np.concatenate([frame.reshape(-1, 3) for frame in originals]), axis=0)
    assert len(source_colors) == 255 and len(PALETTE) == 96
    assert len(np.unique(PALETTE, axis=0)) == 96
    assert all(any(np.array_equal(color, source) for source in source_colors) for color in PALETTE)
    mapper = ColorMapper()
    source_mapped = [mapper(frame) for frame in originals]
    source_styled = [pixel_clusters(frame) for frame in source_mapped]
    motion = None
    if args.source_only:
        inputs, converted, durations = source_paths, source_styled, [80] * 16
    else:
        motion_path = args.motion_dir / 'motion.json'
        if not motion_path.is_file():
            raise SystemExit('Missing motion.json; first run scripts/assets/derive_poetic_motion.py.')
        motion = json.loads(motion_path.read_text())
        inputs = [args.motion_dir / f'frame_{index:03}.png' for index in range(64)]
        frames = [np.asarray(Image.open(path).convert('RGB')) for path in inputs]
        assert all(frame.shape == (HEIGHT, WIDTH, 3) for frame in frames)
        assert all(np.array_equal(frames[index * 4], originals[index]) for index in range(16))
        converted = [pixel_clusters(mapper(frame)) for frame in frames]
        assert all(np.array_equal(converted[index * 4], source_styled[index]) for index in range(16))
        durations = [20] * 64
    OUT.mkdir(parents=True, exist_ok=True)
    columns = 8 if len(converted) == 64 else 4
    save_exact(OUT / 'atlas.png', pack_atlas(converted, columns))
    save_exact(OUT / 'source-atlas.png', pack_atlas(source_styled, 4))
    save_exact(OUT / 'canonical.png', hd_frame(source_styled[0]))
    with tempfile.TemporaryDirectory(prefix='poetic-boot-') as temporary:
        directory = Path(temporary)
        for index, frame in enumerate(converted):
            scale2x(Image.fromarray(frame)).save(directory / f'{index:03}.png')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '50' if len(converted) == 64 else '25/2',
                        '-i', str(directory / '%03d.png'), '-r', '50', '-fps_mode', 'cfr',
                        '-c:v', 'libx264', '-preset', 'medium', '-tune', 'zerolatency', '-crf', '22', '-profile:v', 'baseline',
                        '-pix_fmt', 'yuv420p', '-bf', '0', '-refs', '2', '-g', '64', '-keyint_min', '64', '-sc_threshold', '0',
                        '-video_track_timescale', '50000', '-an', '-movflags', '+faststart', str(OUT / 'boot.mp4')], check=True)
    boot = {'file': 'boot.mp4', 'sha256': sha((OUT / 'boot.mp4').read_bytes()),
            'bytes': (OUT / 'boot.mp4').stat().st_size, 'width': 716, 'height': 534,
            'durationMs': 1280, 'encodingFps': 50, 'sourceFrames': len(converted)}
    archive = ROOT / 'reference-projects/fuji-wind/source-project.zip'
    def descriptor(atlas_name: str, count: int, frame_ms: int, cols: int) -> dict:
        return {'version': 1, 'motionSource': 'source-estimated-interframes' if count == 64 else 'original-source-frames',
                'width': WIDTH, 'height': HEIGHT, 'tileWidth': WIDTH, 'tileHeight': HEIGHT,
                'sourceWidth': WIDTH, 'sourceHeight': HEIGHT, 'outputWidth': 1432, 'outputHeight': 1068,
                'maxOutputWidth': 2864, 'maxOutputHeight': 2136, 'reconstruction': 'scale4x',
                'sourceFrameCount': 16, 'sourceAnchorCount': 16, 'framesPerSourceAnchor': count // 16,
                'frameCount': count, 'frameDurationsMs': [frame_ms] * count, 'durationMs': 1280,
                'loop': 0, 'atlasColumns': cols, 'atlasRows': count // cols,
                'atlas': atlas_name, 'atlasSha256': sha((OUT / atlas_name).read_bytes()),
                'atlasWidth': WIDTH * cols, 'atlasHeight': HEIGHT * (count // cols),
                'canonical': 'canonical.png', 'canonicalSha256': sha((OUT / 'canonical.png').read_bytes()),
                'canonicalWidth': 2864, 'canonicalHeight': 2136,
                'sourceArchiveSha256': sha(archive.read_bytes()), 'boot': boot}
    runtime = descriptor('atlas.png', len(converted), durations[0], columns)
    source_descriptor = descriptor('source-atlas.png', 16, 80, 4)
    mapped_colors = mapper(source_colors[None, :, :])[0]
    manifest = {**runtime, 'sourceDescriptor': source_descriptor,
                'sourceArchive': record(archive), 'palette': PALETTE.tolist(),
                'colorMapping': [{'source': a.tolist(), 'target': b.tolist()} for a,b in zip(source_colors, mapped_colors)],
                'algorithm': {'name': 'shared-source-palette-adaptive-native-contours', 'version': 2,
                    'paletteSize': len(PALETTE), 'paletteSource': 'fixed-original72-plus24-original16-background-hair-weighted-source-colors',
                    'paletteRefinement': {'basePaletteSize': 72, 'addedSourceColors': PALETTE[72:].tolist(),
                        'selection': 'fixed-once-greedy-reduction-of-weighted-squared-RGB-distance-over-original16-frames',
                        'sampleWeights': {'all': 1, 'visibleBackgroundExtra': 5, 'visibleHairExtra': 1.5},
                        'visibleCircle': {'center': [179,133.5], 'radius': 133.5},
                        'backgroundRegion': 'visible && ((x<92 && y<194) || (x>274 && y<148) || (y<64 && (x<110 || x>255)))',
                        'hairRegion': 'visible && ((x<128 && y>40) || (x>232 && y>35) || (y<80 && x>108 && x<252))'},
                    'colorDistance': 'squared-euclidean-rgb; palette-index tie-break',
                    'nativeGrid': [WIDTH, HEIGHT], 'clusterSize': [2,2], 'clusterOrigin': [0,0],
                    'clusterRepresentative': 'most-frequent-mapped-colour; lowest-integer-luminance; RGB-order tie-break',
                    'luminanceWeights': LUMA_WEIGHTS.tolist(), 'maxSelectionDistancePerAxisPx': 1,
                    'contourProtect': {'maxChannelThreshold': CONTOUR_THRESHOLD, 'neighbors': ['north','south','west','east'], 'edgeClamp': True},
                    'fineFeatures': {'eyesRect': [115,82,249,111], 'mouthRect': [157,137,210,153],
                        'blueJewel': 'B>R+20 && G>R+8 && y>111 && 105<x<263',
                        'chain': '184<=y<264 && luminance<1150000 && (abs(x-(130+(y-184)*5/7))<8 || abs(x-(234-(y-184)*5/7))<8)'},
                    'upscale': 'offline-canonical-scale2x-twice-then-nearest2; runtime-scale4x-two-slot-cache-adaptive4-6-8x',
                    'dithering': False, 'blur': False, 'spatialRetargeting': False,
                    'note': 'Native 1px contours retain hair, cherry blossoms and Fuji peak detail;2px material clusters remain. Enlargement does not invent source resolution.'},
                'sourceAnchors': [{'index': i, 'derivedFrameIndex': i * (len(converted)//16),
                    'sourceFile': str(path.relative_to(ROOT)), 'sourceSha256': sha(path.read_bytes()),
                    'sourcePixelSha256': sha(originals[i].tobytes()), 'nativeStylePixelSha256': sha(source_styled[i].tobytes())}
                    for i,path in enumerate(source_paths)],
                'frames': [{'index': i, 'durationMs': durations[i], 'inputFile': str(path.relative_to(ROOT)),
                    'inputSha256': sha(path.read_bytes()), 'inputPixelSha256': sha(np.asarray(Image.open(path).convert('RGB')).tobytes()),
                    'outputPixelSha256': sha(converted[i].tobytes()), 'sourceAnchor': i//(len(converted)//16) if i%(len(converted)//16)==0 else None}
                    for i,path in enumerate(inputs)],
                'motion': motion, 'authoring': [record(Path(__file__).resolve()), record(ROOT/'scripts/assets/scale_pixel_art.py')],
                'files': [record(OUT/name) for name in ('atlas.png','source-atlas.png','canonical.png','boot.mp4')]}
    if motion is not None:
        provenance_path = OUT/'motion-provenance.json'
        provenance_path.write_bytes((args.motion_dir/'motion.json').read_bytes())
        manifest['motionManifest'] = record(provenance_path)
        manifest['authoring'].extend(motion['authoring'])
        manifest['files'].append(record(provenance_path))
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    AUTHOR.parent.mkdir(parents=True,exist_ok=True)
    AUTHOR.write_text('// Generated by scripts/assets/export_poetic_pixel_scene.py; do not edit.\n'
                      'export const poeticPixelAssets = '+json.dumps(runtime,indent=2)+' as const\n'
                      'export const sourcePixelAssets = '+json.dumps(source_descriptor,indent=2)+' as const\n')
    print(json.dumps({'frames': len(converted), 'paletteColors': len(PALETTE), 'atlasBytes': (OUT/'atlas.png').stat().st_size,
                      'canonicalBytes': (OUT/'canonical.png').stat().st_size, 'boot': boot}))


if __name__ == '__main__':
    main()
