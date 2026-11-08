#!/usr/bin/env python3
"""Encode exact-pixel WebP copies of page decoration, preserving all source PNGs.

Run without arguments to regenerate the six lossless derivatives and their
provenance manifest. Run --verify for a standard-library-only provenance, hash,
size and image-header check. Run --check to additionally compare every decoded
RGBA byte. Neither verification mode writes files. Scene assets are never read.

Requires Pillow with WebP support. The manifest records encoder versions because
compressed bytes can differ between libwebp versions despite identical pixels.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import zlib

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / "public/assets/pixel-ui"
MANIFEST = DIRECTORY / "optimization-manifest.json"
NAMES = ("conan", "game-realm", "naruto", "social-github", "social-mail", "twilight-world")
OPTIONS = {"lossless": True, "quality": 100, "method": 6, "exact": True}


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pillow():
    """Import authoring dependencies only for encoding or decoded-pixel checking."""
    try:
        from PIL import Image, __version__ as version, features
    except ImportError:
        raise RuntimeError("Pillow with WebP support is required for authoring or --check; --verify uses only the standard library.")
    if not features.check("webp"):
        raise RuntimeError("Pillow was built without WebP support")
    return Image, version, features.version("webp")


def image_dimensions(path: Path) -> tuple[int, int]:
    """Read the fixed PNG IHDR or single lossless WebP header without decoding."""
    data = path.read_bytes()
    if path.suffix == ".png":
        if (len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or
                data[8:16] != b"\x00\x00\x00\rIHDR" or
                zlib.crc32(data[12:29]) != struct.unpack(">I", data[29:33])[0]):
            raise ValueError(f"{path.name}: invalid PNG header")
        size = struct.unpack(">II", data[16:24])
    elif path.suffix == ".webp":
        if (len(data) < 25 or data[:4] != b"RIFF" or data[8:16] != b"WEBPVP8L" or
                struct.unpack("<I", data[4:8])[0] + 8 != len(data) or data[20] != 0x2F):
            raise ValueError(f"{path.name}: expected a single lossless WebP image")
        chunk_size = struct.unpack("<I", data[16:20])[0]
        bits = struct.unpack("<I", data[21:25])[0]
        if chunk_size < 5 or 20 + chunk_size + (chunk_size & 1) != len(data) or bits >> 29:
            raise ValueError(f"{path.name}: invalid lossless WebP header")
        size = ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
    else:
        raise ValueError("Unsupported decoration image format")
    if min(size) < 1:
        raise ValueError(f"{path.name}: invalid image dimensions")
    return size


def decoded(path: Path) -> tuple[tuple[int, int], bytes]:
    Image, _, _ = pillow()
    with Image.open(path) as image:
        return image.size, image.convert("RGBA").tobytes()


def entry_for(name: str) -> dict[str, object]:
    source, output = DIRECTORY / f"{name}.png", DIRECTORY / f"{name}.webp"
    source_size, source_pixels = decoded(source)
    output_size, output_pixels = decoded(output)
    if output_size != source_size or output_pixels != source_pixels:
        raise ValueError(f"{name}: lossless derivative does not match every source RGBA pixel")
    return {
        "source": source.name,
        "sourceSha256": file_hash(source),
        "sourceBytes": source.stat().st_size,
        "file": output.name,
        "sha256": file_hash(output),
        "bytes": output.stat().st_size,
        "width": source_size[0],
        "height": source_size[1],
        "decodedFormat": "RGBA",
        "decodedSha256": hashlib.sha256(source_pixels).hexdigest(),
        "decodedPixelsIdentical": True,
    }


def build() -> None:
    Image, pillow_version, webp_version = pillow()
    entries = []
    for name in NAMES:
        source, output = DIRECTORY / f"{name}.png", DIRECTORY / f"{name}.webp"
        source_hash = file_hash(source)
        temporary = output.with_suffix(".webp.tmp")
        try:
            with Image.open(source) as image:
                image.convert("RGBA").save(temporary, "WEBP", **OPTIONS)
            if decoded(source) != decoded(temporary):
                raise ValueError(f"{name}: encoder changed source pixels")
            if file_hash(source) != source_hash:
                raise ValueError(f"{name}: source changed during optimization")
            os.replace(temporary, output)
        finally:
            temporary.unlink(missing_ok=True)
        entry = entry_for(name)
        entries.append(entry)
        print(f"{entry['source']}: {entry['sourceBytes']:,} B -> {entry['file']}: {entry['bytes']:,} B; exact RGBA match")
    original = sum(int(entry["sourceBytes"]) for entry in entries)
    optimized = sum(int(entry["bytes"]) for entry in entries)
    manifest = {
        "version": 1,
        "generatedBy": "scripts/assets/optimize_pixel_ui.py",
        "encoder": {"pillow": pillow_version, "libwebp": webp_version, "options": OPTIONS},
        "sourceBytes": original,
        "bytes": optimized,
        "bytesSaved": original - optimized,
        "images": entries,
    }
    temporary_manifest = MANIFEST.with_suffix(".json.tmp")
    temporary_manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(temporary_manifest, MANIFEST)
    print(f"Total: {original:,} B -> {optimized:,} B; saved {(original - optimized) / original:.1%}")


def verify() -> dict[str, object]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if (manifest.get("version") != 1 or
            manifest.get("generatedBy") != "scripts/assets/optimize_pixel_ui.py" or
            manifest.get("encoder", {}).get("options") != OPTIONS):
        raise ValueError("Unsupported decoration provenance manifest")
    entries = manifest.get("images")
    if not isinstance(entries, list) or len(entries) != len(NAMES):
        raise ValueError("Decoration manifest must identify exactly six source/derivative pairs")
    for name, entry in zip(NAMES, entries):
        if not isinstance(entry, dict) or entry.get("source") != f"{name}.png" or entry.get("file") != f"{name}.webp":
            raise ValueError("Unexpected decoration path or manifest order")
        source, output = DIRECTORY / f"{name}.png", DIRECTORY / f"{name}.webp"
        size = image_dimensions(source)
        digest = entry.get("decodedSha256")
        if (image_dimensions(output) != size or (entry.get("width"), entry.get("height")) != size or
                file_hash(source) != entry.get("sourceSha256") or file_hash(output) != entry.get("sha256") or
                source.stat().st_size != entry.get("sourceBytes") or output.stat().st_size != entry.get("bytes") or
                entry.get("decodedFormat") != "RGBA" or entry.get("decodedPixelsIdentical") is not True or
                not isinstance(digest, str) or len(digest) != 64 or set(digest) - set("0123456789abcdef")):
            raise ValueError(f"{name}: decoration provenance/hash/size/dimensions do not match")
    source_bytes = sum(entry["sourceBytes"] for entry in entries)
    output_bytes = sum(entry["bytes"] for entry in entries)
    if (manifest.get("sourceBytes") != source_bytes or manifest.get("bytes") != output_bytes or
            manifest.get("bytesSaved") != source_bytes - output_bytes):
        raise ValueError("Decoration size totals do not match the verified assets")
    return manifest


def check() -> None:
    manifest = verify()
    actual = [entry_for(name) for name in NAMES]
    if manifest["images"] != actual:
        raise ValueError("Decoded RGBA pixels differ from the recorded decoration provenance")
    print(f"Decoration verification OK: {len(actual)} exact RGBA matches; all source/output hashes and dimensions match")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="verify provenance and compare every decoded RGBA byte (requires Pillow)")
    mode.add_argument("--verify", action="store_true", help="verify hashes, dimensions, sizes and manifest using only the standard library")
    arguments = parser.parse_args()
    if arguments.verify:
        verify()
        print("Decoration provenance OK: six PNG/WebP pairs; hashes, image headers, dimensions and sizes verified (standard library)")
    elif arguments.check:
        check()
    else:
        build()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Decoration optimization failed: {error}", file=sys.stderr)
        raise SystemExit(1)
