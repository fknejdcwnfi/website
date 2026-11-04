#!/usr/bin/env python3
"""Verify generated web assets without Pillow.

Checks:
  1. The manifest lists exactly ten frames.
  2. Every derived file exists with the recorded size and SHA-256.
  3. frame_01.png and frame_10.png are byte-identical (seamless loop).
  4. Required public files exist (OG image, favicon, robots, sitemap).
  5. Portrait grid dimensions, checksums and retained source provenance match.

This is intentionally stdlib-only so CI can run it on a plain Python 3 image.
"""

from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "public" / "assets" / "manifest.json"
FRAME_DIR = ROOT / "assets" / "source" / "frames"
REQUIRED_PUBLIC = (
    "portrait-rest.png",
    "fonts/PressStart2P-Regular.ttf",
    "fonts/OFL.txt",
    "og-portrait.png",
    "og-pixel.png",
    "og-image.webp",
    "favicon.svg",
    "robots.txt",
    "sitemap.xml",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def main() -> int:
    errors: list[str] = []

    if not MANIFEST.exists():
        print(f"missing manifest: {MANIFEST.relative_to(ROOT)}", file=sys.stderr)
        return 1

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    frames = manifest.get("frames", [])
    if len(frames) != 10:
        fail(errors, f"manifest should list 10 frames, found {len(frames)}")

    for entry in frames:
        relative = entry.get("file", "")
        derived = ROOT / "public" / relative
        if not derived.exists():
            fail(errors, f"missing derived frame: public/{relative}")
            continue
        if derived.stat().st_size != entry.get("bytes"):
            fail(errors, f"size mismatch: public/{relative}")
        if sha256(derived) != entry.get("sha256"):
            fail(errors, f"sha256 mismatch: public/{relative}")

    source_1 = FRAME_DIR / "frame_01.png"
    source_10 = FRAME_DIR / "frame_10.png"
    for source in (source_1, source_10):
        if not source.exists():
            fail(errors, f"missing source frame: {source.relative_to(ROOT)}")
    if source_1.exists() and source_10.exists():
        if sha256(source_1) != sha256(source_10):
            fail(errors, "frame_01.png and frame_10.png are not byte-identical")

    for name in REQUIRED_PUBLIC:
        path = ROOT / "public" / name
        if not path.exists() or path.stat().st_size == 0:
            fail(errors, f"missing or empty public file: public/{name}")

    portrait_root = ROOT / 'public' / 'assets' / 'portrait-natural'
    portrait_manifest = portrait_root / 'manifest.json'
    if not portrait_manifest.exists():
        fail(errors, 'missing portrait asset manifest')
    else:
        portrait = json.loads(portrait_manifest.read_text(encoding='utf-8'))
        entries = portrait.get('files', [])
        if len(entries) != 9:
            fail(errors, 'portrait manifest must contain nine reviewed grid assets (portrait, eyelids, underpaint)')
        for entry in entries:
            path = portrait_root / entry['file']
            if not path.is_file():
                fail(errors, f'missing portrait asset: {entry["file"]}')
                continue
            data = path.read_bytes()
            if hashlib.sha256(data).hexdigest() != entry['sha256'] or len(data) != entry['bytes']:
                fail(errors, f'portrait integrity mismatch: {entry["file"]}')
            if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n':
                fail(errors, f'invalid portrait PNG: {entry["file"]}')
            elif struct.unpack('>II', data[16:24]) != (entry['width'], entry['height']):
                fail(errors, f'portrait dimensions mismatch: {entry["file"]}')
            elif entry['height'] != entry['width']:
                fail(errors, f'portrait must retain original square close-up proportions: {entry["file"]}')
        authority = ROOT / portrait['authority']
        if not authority.is_file() or sha256(authority) != portrait['authority_sha256']:
            fail(errors, 'portrait original-reference provenance mismatch')
        for entry in portrait.get('masters', []):
            path = ROOT / entry['file']
            if not path.is_file() or sha256(path) != entry['sha256']:
                fail(errors, f'portrait master provenance mismatch: {entry["file"]}')

    layered_manifest = ROOT / 'public' / 'assets' / 'portrait-rig' / 'manifest.json'
    if not layered_manifest.is_file():
        fail(errors, 'missing layered portrait selection manifest')
    else:
        layered = json.loads(layered_manifest.read_text(encoding='utf-8'))
        canonical = ROOT / layered['canonical']
        if not canonical.is_file() or sha256(canonical) != layered['canonical_sha256']:
            fail(errors, 'layered portrait canonical provenance mismatch')
        for entry in layered['files']:
            path = ROOT / entry['file']
            if not path.is_file():
                fail(errors, f'missing layered material: {entry["file"]}')
                continue
            data = path.read_bytes()
            if sha256(path) != entry['sha256'] or len(data) != entry['bytes']:
                fail(errors, f'layered material integrity mismatch: {entry["file"]}')
            if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', data[16:24]) != (entry['width'], entry['height']):
                fail(errors, f'invalid layered material PNG: {entry["file"]}')

    baked_manifest = ROOT / 'public' / 'assets' / 'portrait-rig' / 'baked-manifest.json'
    if not baked_manifest.is_file():
        fail(errors, 'missing baked portrait manifest')
    else:
        baked = json.loads(baked_manifest.read_text(encoding='utf-8'))
        for category in ('sources', 'inputs', 'files'):
            for entry in baked[category]:
                path = ROOT / entry['file']
                if not path.is_file():
                    fail(errors, f'missing baked dependency: {entry["file"]}')
                    continue
                data = path.read_bytes()
                if len(data) != entry['bytes'] or sha256(path) != entry['sha256']:
                    fail(errors, f'stale baked dependency: {entry["file"]}; re-export portrait layers')
                if entry['file'].endswith('.png') and (len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n' or
                    struct.unpack('>II', data[16:24]) != (entry['width'], entry['height'])):
                    fail(errors, f'invalid baked PNG: {entry["file"]}')
                if category == 'files' and entry['file'].endswith('.json'):
                    metadata = json.loads(data)
                    atlas = path.parent / metadata['atlas']
                    if metadata['size'] != entry['size'] or not atlas.is_file() or sha256(atlas) != metadata['atlas_sha256']:
                        fail(errors, f'baked metadata/atlas mismatch: {entry["file"]}')

    physics_manifest = ROOT / 'public' / 'assets' / 'portrait-rig' / 'physics-manifest.json'
    if not physics_manifest.is_file():
        fail(errors, 'missing baked physics manifest')
    else:
        physics = json.loads(physics_manifest.read_text(encoding='utf-8'))
        if physics.get('version') != 1 or len(physics.get('inputs', [])) != 3:
            fail(errors, 'invalid baked physics manifest')
        for category in ('sources', 'inputs', 'files'):
            for entry in physics.get(category, []):
                path = ROOT / entry['file']
                if not path.is_file() or path.stat().st_size != entry['bytes'] or sha256(path) != entry['sha256']:
                    fail(errors, f'stale baked physics dependency: {entry["file"]}; run node scripts/assets/export_baked_physics.mjs')

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("asset verification OK: legacy frames, portrait grids, provenance, public files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
