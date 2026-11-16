# Page decoration authoring sources

These six PNGs were moved byte for byte from `public/assets/pixel-ui/` during
repository maintenance. They remain the authoring sources for the same lossless
WebP files; the website serves the derivatives instead of publishing both copies.
They are separate from the immutable original character artwork.

The [current provenance manifest](../../../public/assets/pixel-ui/optimization-manifest.json)
records each project-relative source path, original SHA-256, output SHA-256,
dimensions and decoded RGBA digest. To verify the original bytes and full decoded
pixel match without rewriting files:

```bash
python3 scripts/assets/optimize_pixel_ui.py --verify
python3 scripts/assets/optimize_pixel_ui.py --check
```

The first command uses only Python's standard library. The second requires
Pillow with WebP support. Regeneration uses the same script without a flag.
