#!/usr/bin/env python3
"""Regenerate the web-served image derivatives from the source art.

Source of truth lives in ``assets/source/`` and is never modified.
Outputs live in ``public/assets/`` and are safe to delete and rebuild.

Usage:
    python3 scripts/assets/optimize_assets.py
    python3 scripts/assets/optimize_assets.py --check

Requires Pillow (``python3 -m pip install Pillow``).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - environment guard
    sys.exit("Pillow is required: python3 -m pip install Pillow")

ROOT = Path(__file__).resolve().parents[2]
SRC_FRAMES = ROOT / "assets" / "source" / "frames"
SRC_REFERENCE = ROOT / "assets" / "source" / "original_reference.jpg"
OUT_FRAMES = ROOT / "public" / "assets" / "frames"
OUT_MANIFEST = ROOT / "public" / "assets" / "manifest.json"
OUT_OG = ROOT / "public" / "og-image.webp"

MAX_SIDE = 1080
WEBP_QUALITY = 86
WEBP_METHOD = 6
OG_SIZE = (1200, 630)
BACKGROUND = (9, 13, 21)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_rgb(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGB")


def render_frame(source: Path, destination: Path) -> dict[str, object]:
    image = load_rgb(source)
    width, height = image.size
    if width != height:
        raise SystemExit(f"{source.name}: expected a square 1:1 frame, got {width}x{height}")

    scale = min(1.0, MAX_SIDE / max(width, height))
    if scale < 1.0:
        size = (round(width * scale), round(height * scale))
        image = image.resize(size, Image.Resampling.LANCZOS)

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)

    return {
        "file": f"assets/frames/{destination.name}",
        "source": f"assets/source/frames/{source.name}",
        "width": image.width,
        "height": image.height,
        "bytes": destination.stat().st_size,
        "sha256": sha256(destination),
    }


def render_og_image(destination: Path) -> None:
    image = load_rgb(SRC_REFERENCE)
    scale = OG_SIZE[1] / image.height
    resized = image.resize(
        (round(image.width * scale), OG_SIZE[1]), Image.Resampling.LANCZOS
    )
    canvas = Image.new("RGB", OG_SIZE, BACKGROUND)
    canvas.paste(resized, ((OG_SIZE[0] - resized.width) // 2, 0))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, "WEBP", quality=90, method=WEBP_METHOD)


def collect_frames() -> list[Path]:
    frames = sorted(SRC_FRAMES.glob("frame_*.png"))
    if len(frames) != 10:
        raise SystemExit(f"expected 10 source frames, found {len(frames)}")
    return frames


def build() -> None:
    frames = collect_frames()
    entries = []
    for source in frames:
        destination = OUT_FRAMES / f"{source.stem}.webp"
        entries.append(render_frame(source, destination))
        print(f"  {source.name} -> {destination.relative_to(ROOT)} ({entries[-1]['bytes']:,} B)")

    render_og_image(OUT_OG)

    manifest = {
        "generatedBy": "scripts/assets/optimize_assets.py",
        "maxSide": MAX_SIDE,
        "webpQuality": WEBP_QUALITY,
        "frames": entries,
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {OUT_MANIFEST.relative_to(ROOT)} and {OUT_OG.relative_to(ROOT)}")


def check() -> int:
    frames = collect_frames()
    missing = [
        OUT_FRAMES / f"{frame.stem}.webp"
        for frame in frames
        if not (OUT_FRAMES / f"{frame.stem}.webp").exists()
    ]
    missing += [path for path in (OUT_MANIFEST, OUT_OG) if not path.exists()]
    if missing:
        for path in missing:
            print(f"missing: {path.relative_to(ROOT)}", file=sys.stderr)
        return 1
    print("asset derivatives are present")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify outputs exist without rewriting")
    args = parser.parse_args()

    if args.check:
        return check()
    build()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())