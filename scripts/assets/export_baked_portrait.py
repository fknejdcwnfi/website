#!/usr/bin/env python3
"""Bake the reviewed hair materials into lossless runtime atlases using Canvas.

Run against a Vite development server. Python writes the browser's exact PNG
bytes and metadata; all image preparation remains in createHairMaterials.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import struct
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'public/assets/portrait-rig'
SIZES = (192, 256, 320)
SOURCES = (
    'src/features/portrait/renderer/hairMaterials.ts',
    'src/features/portrait/renderer/hairTypes.ts',
    'src/features/portrait/renderer/portraitJewelry.ts',
    'src/features/portrait/renderer/portraitAsset.ts',
)

BAKE = r'''async (size) => {
    const { createHairMaterials } = await import('/src/features/portrait/renderer/hairMaterials.ts');
    const { loadImage } = await import('/src/features/portrait/renderer/portraitAsset.ts');
    const suffix = size === 256 ? '' : '-' + size;
    const images = await Promise.all(['base', 'eyelids', 'underpaint'].map(name =>
        loadImage('/assets/portrait-natural/' + name + suffix + '.png')));
    const matte = await loadImage('/assets/portrait-rig/hair-matte' + suffix + '.png');
    const source = createHairMaterials(images[0], images[1], images[2], size, matte);
    if (source.locks.length > 254) throw new Error('Ownership cannot fit in the baked mask channel.');
    const columns = 4, rows = Math.ceil((5 + source.locks.length + source.shadows.length) / columns);
    const canvas = document.createElement('canvas');
    canvas.width = size * columns; canvas.height = size * rows;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('A Canvas context is required to bake materials.');
    context.imageSmoothingEnabled = false;
    const put = (pixels, tile) => {
        if (pixels.length !== size * size) throw new Error('Unexpected source tile length.');
        const rgba = new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength);
        context.putImageData(new ImageData(rgba, size, size), tile % columns * size,
            Math.floor(tile / columns) * size);
    };
    put(source.canonical, 0); put(source.closed, 1); put(source.clean, 2); put(source.repair, 3);
    const masks = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < source.ownership.length; i += 1) {
        const owner = source.ownership[i];
        if (owner < -1 || owner >= source.locks.length) throw new Error('Invalid source ownership.');
        if (source.faceMask[i] > 1 || source.bodyMask[i] > 1) throw new Error('Masks must be binary.');
        masks[i * 4] = owner + 1;
        masks[i * 4 + 1] = source.faceMask[i] * 255;
        masks[i * 4 + 2] = source.bodyMask[i] * 255;
        masks[i * 4 + 3] = 255;
    }
    context.putImageData(new ImageData(masks, size, size), 0, size);
    const material = (value, tile) => {
        put(value.pixels, tile);
        return { id: value.id, z: value.z, side: value.side, bounds: { ...value.bounds },
            spine: Array.from(value.spine), motion: { ...value.motion }, tile };
    };
    const locks = source.locks.map((value, index) => material(value, 5 + index));
    const shadows = source.shadows.map((value, index) => ({ id: value.id, lock: value.lock,
        material: material(value.material, 5 + source.locks.length + index) }));
    const metadata = { version: 1, size, columns, rows, atlas: 'rig-' + size + '.png',
        tiles: { canonical: 0, closed: 1, clean: 2, repair: 3, masks: 4 }, locks, shadows };
    const png = canvas.toDataURL('image/png');
    // The atlas includes binary-alpha art and opaque mask channels. Verify its
    // PNG encode/decode round trip before permitting any output to be written.
    const expected = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const decoded = await loadImage(png);
    const check = document.createElement('canvas');
    check.width = canvas.width; check.height = canvas.height;
    const checkContext = check.getContext('2d', { willReadFrequently: true });
    if (!checkContext) throw new Error('A Canvas verification context is required.');
    checkContext.imageSmoothingEnabled = false;
    checkContext.drawImage(decoded, 0, 0);
    const actual = checkContext.getImageData(0, 0, check.width, check.height).data;
    for (let i = 0; i < expected.length; i += 1) {
        if (actual[i] !== expected[i]) throw new Error('PNG changed atlas byte ' + i);
    }
    return { png: png.split(',')[1], metadata };
}'''


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def indexed_png(source: bytes) -> bytes:
    """Encode existing RGBA tuples directly; never quantize or dither pixels."""
    image = Image.open(io.BytesIO(source)).convert('RGBA')
    colors = image.getcolors(maxcolors=256)
    if colors is None:
        return source
    # Frequency ordering is deterministic and retains distinct RGBA entries even
    # when transparent and opaque colors happen to share the same RGB tuple.
    colors.sort(key=lambda entry: (-entry[0], entry[1]))
    rgba = [entry[1] for entry in colors]
    lookup = {color: index for index, color in enumerate(rgba)}
    pixels = image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()
    indices = bytes(lookup[color] for color in pixels)
    indexed = Image.frombytes('P', image.size, indices)
    palette = [channel for color in rgba for channel in color[:3]]
    indexed.putpalette(palette + [0] * (768 - len(palette)))
    output = io.BytesIO()
    indexed.save(output, format='PNG', compress_level=9, optimize=True,
                 transparency=bytes(color[3] for color in rgba))
    encoded = output.getvalue()
    restored = Image.open(io.BytesIO(encoded)).convert('RGBA')
    if restored.tobytes() != image.tobytes() or len(encoded) >= len(source):
        return source
    return encoded


def describe(path: Path) -> dict:
    data = path.read_bytes()
    entry = {'file': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': sha256(path)}
    if path.suffix == '.png':
        if data[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError(f'Invalid PNG: {path}')
        width, height = struct.unpack('>II', data[16:24])
        entry.update(width=width, height=height)
    return entry


def input_paths() -> list[Path]:
    paths = []
    for size in SIZES:
        suffix = '' if size == 256 else f'-{size}'
        paths.extend(ROOT / f'public/assets/portrait-natural/{name}{suffix}.png'
                     for name in ('base', 'eyelids', 'underpaint'))
        paths.append(OUTPUT / f'hair-matte{suffix}.png')
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5173/')
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    args = parser.parse_args()
    sources = [ROOT / relative for relative in SOURCES]
    inputs = input_paths()
    before = {path: sha256(path) for path in [*sources, *inputs]}
    exported = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, args=['--no-sandbox'])
        try:
            page = browser.new_page()
            # A same-origin blank HTML document avoids starting the application
            # or requiring the baked runtime files before they have been made.
            address = urljoin(args.url.rstrip('/') + '/', '__portrait_bake_export__.html')
            page.route(address, lambda route: route.fulfill(
                status=200, content_type='text/html',
                body='<!doctype html><html><head><title>Portrait bake</title></head><body></body></html>'))
            page.goto(address, wait_until='domcontentloaded')
            for size in SIZES:
                exported.append(page.evaluate(BAKE, size))
        finally:
            browser.close()
    changed = [str(path.relative_to(ROOT)) for path, digest in before.items() if sha256(path) != digest]
    if changed:
        raise RuntimeError('Inputs changed while baking; no output written: ' + ', '.join(changed))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    files = []
    for size, result in zip(SIZES, exported, strict=True):
        png = OUTPUT / f'rig-{size}.png'
        metadata = OUTPUT / f'rig-{size}.json'
        original_png = base64.b64decode(result['png'], validate=True)
        png_bytes = indexed_png(original_png)
        result['metadata']['atlas_sha256'] = hashlib.sha256(png_bytes).hexdigest()
        png.write_bytes(png_bytes)
        metadata.write_text(json.dumps(result['metadata'], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        image_entry = describe(png)
        expected = size * result['metadata']['columns'], size * result['metadata']['rows']
        if (image_entry['width'], image_entry['height']) != expected:
            raise RuntimeError(f'Incorrect baked atlas size: {png}')
        files.extend([image_entry, {**describe(metadata), 'size': size}])
        print(f'{size}: Canvas PNG {len(original_png)} bytes -> exact indexed PNG {len(png_bytes)} bytes')
    manifest = {
        'version': 1,
        'method': 'Unchanged createHairMaterials Canvas output, packed losslessly at build time. Canvas PNG round trip and explicit RGBA-to-indexed-PNG round trip verified byte-for-byte; no color quantization or dithering.',
        'logical_sizes': list(SIZES),
        'sources': [describe(path) for path in sources],
        'inputs': [describe(path) for path in inputs],
        'files': files,
    }
    (OUTPUT / 'baked-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Baked {len(SIZES)} unchanged portrait grids into {len(files)} runtime files; all PNG round trips exact.')


if __name__ == '__main__':
    main()
