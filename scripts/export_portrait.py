#!/usr/bin/env python3
"""Export the shared Canvas palette/grid pipeline through a running Vite server.

Requires Python Playwright and Chromium. No image edits are performed in Python:
the browser runs normalizeArtwork, and this script writes its exact PNG output.
AI-assisted masters are kept intact under assets/generated/portrait-v2/.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import struct
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5173/')
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    args = parser.parse_args()
    output = ROOT / 'public/assets/portrait'
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, args=['--no-sandbox'])
        page = browser.new_page()
        page.goto(args.url.rstrip('/') + '/?style=voxel&pose=1')
        for name, master in [('base', 'open'), ('eyelids', 'closed')]:
            for size in [192, 256, 320]:
                source = ROOT / f'assets/generated/portrait-v2/{master}.png'
                data = page.evaluate('''async ({size, path}) => {
                    const {loadImage, normalizeArtwork} = await import('/src/character/portraitAsset.ts');
                    const source = await loadImage('/@fs' + path);
                    return normalizeArtwork(source, size).toDataURL('image/png').split(',')[1];
                }''', {'size': size, 'path': str(source)})
                suffix = '' if size == 256 else f'-{size}'
                (output / f'{name}{suffix}.png').write_bytes(base64.b64decode(data))
        palette_colors = page.evaluate("async () => (await import('/src/character/portraitAsset.ts')).PALETTE.length")
        browser.close()
    files = []
    for path in sorted(output.glob('*.png')):
        data = path.read_bytes()
        width, height = struct.unpack('>II', data[16:24])
        files.append({'file': path.name, 'width': width, 'height': height,
                      'bytes': len(data), 'sha256': sha256(path)})
    reference = ROOT / 'assets/source/original_reference.jpg'
    masters = [{'file': str(path.relative_to(ROOT)), 'sha256': sha256(path)}
               for path in sorted((ROOT / 'assets/generated/portrait-v2').glob('*.png'))]
    manifest = {
        'version': 2, 'authority': str(reference.relative_to(ROOT)),
        'authority_sha256': sha256(reference),
        'method': 'AI-assisted pixel-art redraw from original reference; closed-eye edit used only in eye polygons. Shared Canvas palette/grid normalization; no independent animation-face frames.',
        'palette': 'src/character/portraitAsset.ts#PALETTE', 'palette_colors': palette_colors,
        'logical_sizes': [192, 256, 320], 'default_size': 256, 'masters': masters, 'files': files,
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Exported {len(files)} portrait assets; {palette_colors} palette colors; sources preserved')


if __name__ == '__main__':
    main()
