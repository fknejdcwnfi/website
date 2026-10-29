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

ROOT = Path(__file__).resolve().parent.parent
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

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("asset verification OK: legacy frames, portrait grids, provenance, public files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
