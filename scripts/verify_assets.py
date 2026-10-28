#!/usr/bin/env python3
"""Verify generated web assets without Pillow.

Checks:
  1. The manifest lists exactly ten frames.
  2. Every derived file exists with the recorded size and SHA-256.
  3. frame_01.png and frame_10.png are byte-identical (seamless loop).
  4. Required public files exist (OG image, favicon, robots, sitemap).

This is intentionally stdlib-only so CI can run it on a plain Python 3 image.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "public" / "assets" / "manifest.json"
FRAME_DIR = ROOT / "assets" / "source" / "frames"
REQUIRED_PUBLIC = (
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

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("asset verification OK: 10 frames, manifest hashes, loop pair, public files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
