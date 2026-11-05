#!/usr/bin/env python3
"""Source-color-only Scale2x edge reconstruction for offline presentation assets.

This changes the two-times output grid, not the original images. It neither
recovers detail missing from the source nor invents new interpolated colors.
The browser implementation in pixelArtScale.ts uses the same five-neighbor rule.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def scale2x(image: Image.Image) -> Image.Image:
    """Return a 2x RGB/RGBA image using existing colors and edge-clamped neighbors.

    RGB sources stay RGB. Alpha-bearing images (including transparent P images)
    remain RGBA; transparent holes are sampled as colors, without compositing onto
    a preceding frame or background. Every original pixel remains the unique
    most frequent color in its corresponding 2x2 output block.
    """
    if image.width < 1 or image.height < 1:
        raise ValueError('Scale2x requires a non-empty source image.')
    mode = 'RGBA' if 'A' in image.getbands() or 'transparency' in image.info else 'RGB'
    center = np.asarray(image.convert(mode))
    padded = np.pad(center, ((1, 1), (1, 1), (0, 0)), mode='edge')
    north = padded[:-2, 1:-1]
    west = padded[1:-1, :-2]
    east = padded[1:-1, 2:]
    south = padded[2:, 1:-1]

    def equal(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.all(a == b, axis=-1)

    edge = ~equal(north, south) & ~equal(west, east)
    output = np.repeat(np.repeat(center, 2, axis=0), 2, axis=1)
    output[::2, ::2] = np.where((edge & equal(west, north))[..., None], west, center)
    output[::2, 1::2] = np.where((edge & equal(north, east))[..., None], east, center)
    output[1::2, ::2] = np.where((edge & equal(west, south))[..., None], west, center)
    output[1::2, 1::2] = np.where((edge & equal(south, east))[..., None], east, center)
    return Image.fromarray(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.destination.resolve():
        parser.error('Write a derivative destination; never replace the source image.')
    image = Image.open(args.source)
    result = scale2x(image)
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.destination)
    print(f'{image.width}x{image.height} -> {result.width}x{result.height}: {args.destination}')


if __name__ == '__main__':
    main()
