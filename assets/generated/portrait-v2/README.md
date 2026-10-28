# Pixel portrait v2 artwork provenance

The original reference at `assets/source/original_reference.jpg` was supplied by the owner and remains untouched.

- `open.png`: AI-assisted2Dpixel-art reinterpretation generated from the original reference, preserving the close crop, pointed chin, tilted blue eyes, asymmetrical long curls and sapphire jewelry. Not a claim of exact facial geometry.
- `closed.png`: closed-eye edit of the same pixel master. The renderer uses only two eye polygons; all other pixels always come from the open master.
- Generated2026-10-28 with the image-generation tool. No original source frames were overwritten, and no ten-frame AI sequence is used for animation.
- Browser Canvas export through `normalizeArtwork` in `src/character/portraitAsset.ts` produces42-color, opaque192/256/320 grids for runtime.
- Exported runtime files and SHA-256 provenance are recorded in `public/assets/portrait/manifest.json`.

This is personal noncommercial fan artwork. Existing character/material restrictions in `docs/02-asset-inventory.md` continue to apply.
