#!/usr/bin/env python3
"""Prepare smaller card decorations without changing full-size source pixels.

Nearest-neighbor sampling reduces resolution; lossless WebP preserves those
sampled RGBA pixels. It does not retain every original pixel. Full-size WebPs
remain available for fallback/high-density views; the portrait is never read.
--verify checks fixed paths, hashes, dimensions and provenance with stdlib only.
--check additionally compares all decoded pixels with the specified resize.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile

from optimize_pixel_ui import image_dimensions, pillow, verify as verify_full_decor

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / 'public/assets/pixel-ui'
OUTPUT = DIRECTORY / 'responsive'
MANIFEST = DIRECTORY / 'responsive-manifest.json'
NAMES = ('conan', 'game-realm', 'naruto', 'social-github', 'social-mail')
WIDTHS = (768, 1024, 1536)
OPTIONS = {'lossless': True, 'quality': 100, 'method': 6, 'exact': True}
RESIZE = 'nearest-neighbor'


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_digest(path: Path) -> str:
    return digest(path.read_bytes())


def scaled_size(source: tuple[int, int], width: int) -> tuple[int, int]:
    # Integer half-up rounding is shared by authoring and verification.
    return width, (source[1] * width + source[0] // 2) // source[0]


def valid_digest(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and not set(value) - set('0123456789abcdef')


def build() -> dict[str, object]:
    verify_full_decor()
    Image, pillow_version, webp_version = pillow()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    images = []
    for name in NAMES:
        source = DIRECTORY / f'{name}.webp'
        source_hash = file_digest(source)
        with Image.open(source) as opened:
            full = opened.convert('RGBA')
        entry = {'source': source.name, 'sourceSha256': source_hash,
                 'sourceBytes': source.stat().st_size,
                 'width': full.width, 'height': full.height, 'variants': []}
        for width in WIDTHS:
            if width >= full.width:
                raise ValueError(f'{name}: responsive width must be smaller than the full source')
            size = scaled_size(full.size, width)
            sampled = full.resize(size, Image.Resampling.NEAREST)
            target = OUTPUT / f'{name}-{width}.webp'
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=OUTPUT, suffix='.webp', delete=False) as handle:
                    temporary = Path(handle.name)
                sampled.save(temporary, 'WEBP', **OPTIONS)
                with Image.open(temporary) as decoded:
                    actual = decoded.convert('RGBA')
                    if actual.size != size or actual.tobytes() != sampled.tobytes():
                        raise ValueError(f'{target.name}: encoding changed sampled pixels')
                os.replace(temporary, target)
                target.chmod(0o644)
            finally:
                if temporary:
                    temporary.unlink(missing_ok=True)
            entry['variants'].append({'file': target.relative_to(DIRECTORY).as_posix(),
                'width': size[0], 'height': size[1], 'bytes': target.stat().st_size,
                'sha256': file_digest(target), 'decodedFormat': 'RGBA',
                'decodedSha256': digest(sampled.tobytes())})
        if file_digest(source) != source_hash:
            raise ValueError(f'{name}: source changed during responsive preparation')
        images.append(entry)
    report = {'version': 1, 'generatedBy': 'scripts/assets/prepare_responsive_decor.py',
        'resample': RESIZE, 'dimensionsRounding': 'integer-half-up',
        'fullSourcesPreserved': True, 'allOriginalPixelsRetainedInVariants': False,
        'encoder': {'pillow': pillow_version, 'libwebp': webp_version, 'options': OPTIONS},
        'images': images,
        'fullSourceBytes': sum(entry['sourceBytes'] for entry in images),
        'variantBytes': sum(variant['bytes'] for entry in images for variant in entry['variants'])}
    temporary_manifest = MANIFEST.with_suffix('.json.tmp')
    try:
        temporary_manifest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        os.replace(temporary_manifest, MANIFEST)
    finally:
        temporary_manifest.unlink(missing_ok=True)
    return report


def verify() -> dict[str, object]:
    verify_full_decor()
    report = json.loads(MANIFEST.read_text())
    if not isinstance(report, dict) or not isinstance(report.get('encoder'), dict):
        raise ValueError('Responsive provenance must be a structured manifest')
    if (report.get('version') != 1 or report.get('generatedBy') != 'scripts/assets/prepare_responsive_decor.py' or
            report.get('resample') != RESIZE or report.get('dimensionsRounding') != 'integer-half-up' or
            report.get('fullSourcesPreserved') is not True or report.get('allOriginalPixelsRetainedInVariants') is not False or
            report.get('encoder', {}).get('options') != OPTIONS):
        raise ValueError('Unsupported responsive decoration provenance')
    images = report.get('images')
    if not isinstance(images, list) or len(images) != len(NAMES):
        raise ValueError('Responsive manifest must contain exactly five source images')
    for name, entry in zip(NAMES, images):
        source = DIRECTORY / f'{name}.webp'
        dimensions = image_dimensions(source)
        if (not isinstance(entry, dict) or entry.get('source') != source.name or
                entry.get('sourceSha256') != file_digest(source) or entry.get('sourceBytes') != source.stat().st_size or
                (entry.get('width'), entry.get('height')) != dimensions):
            raise ValueError(f'{name}: full-source hash, size or dimensions changed')
        variants = entry.get('variants')
        if not isinstance(variants, list) or len(variants) != len(WIDTHS):
            raise ValueError(f'{name}: expected {len(WIDTHS)} responsive variants')
        for width, variant in zip(WIDTHS, variants):
            expected = f'responsive/{name}-{width}.webp'
            output = DIRECTORY / expected
            size = scaled_size(dimensions, width)
            if (width >= dimensions[0] or not isinstance(variant, dict) or variant.get('file') != expected or
                    (variant.get('width'), variant.get('height')) != size or image_dimensions(output) != size or
                    variant.get('bytes') != output.stat().st_size or variant.get('sha256') != file_digest(output) or
                    variant.get('decodedFormat') != 'RGBA' or not valid_digest(variant.get('decodedSha256'))):
                raise ValueError(f'{name}: responsive path, hash, dimensions or size changed')
    full_bytes = sum(entry['sourceBytes'] for entry in images)
    variant_bytes = sum(variant['bytes'] for entry in images for variant in entry['variants'])
    if report.get('fullSourceBytes') != full_bytes or report.get('variantBytes') != variant_bytes:
        raise ValueError('Responsive byte totals do not match verified files')
    expected_files = {f'{name}-{width}.webp' for name in NAMES for width in WIDTHS}
    if not OUTPUT.is_dir() or {path.name for path in OUTPUT.iterdir()} != expected_files:
        raise ValueError('Responsive directory contains missing or unregistered files')
    return report


def check() -> dict[str, object]:
    report = verify()
    Image, _, _ = pillow()
    for entry in report['images']:
        with Image.open(DIRECTORY / entry['source']) as opened:
            full = opened.convert('RGBA')
        for variant in entry['variants']:
            expected = full.resize((variant['width'], variant['height']), Image.Resampling.NEAREST)
            with Image.open(DIRECTORY / variant['file']) as opened:
                actual = opened.convert('RGBA')
            pixels = actual.tobytes()
            if actual.size != expected.size or pixels != expected.tobytes() or digest(pixels) != variant['decodedSha256']:
                raise ValueError(f'{variant["file"]}: pixels do not match the recorded nearest-neighbor sample')
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--verify', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.verify:
        report = verify()
    elif args.check:
        report = check()
    else:
        build()
        report = verify()
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'check' if args.check else 'generate',
        'sources': len(report['images']), 'variants': sum(len(entry['variants']) for entry in report['images']),
        'fullSourceBytes': report['fullSourceBytes'], 'variantBytes': report['variantBytes'],
        'resample': RESIZE, 'allOriginalPixelsRetainedInVariants': False}))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, KeyError, TypeError) as error:
        print(f'Responsive decoration failed: {error}', file=sys.stderr)
        raise SystemExit(1)
