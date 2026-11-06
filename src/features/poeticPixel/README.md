# Current scene

This is the only normal-homepage character feature. Source artwork, native atlas,
50fps source estimates and the circle composition are independent of weather and
render-buffer size.

- `definition.ts` / generated `assets.ts`: immutable source-derived asset contract.
- `renderer.ts`: abort-safe preparation, original source clock, current frame and
  atmosphere composition. Constructors share one cleanup guard.
- `presentation/`: one bounded native-atlas readback with immediate bitmap/image
  cleanup, source-color Scale4x with a strided first pass and two-frame cache,
  pure4/6/8× resolution policy and resize/DPR hook. Resizing preserves the atlas.
- `atmosphere/`: 448 snowflakes /60 petals, cached32-angle/5-pose hard-alpha sprites.
  Painters accept raw visible elapsed time and optional layer opacity.
- `bootstrap.ts`: pure entry markup for static generation, retained parser nodes,
  pause/cleanup and180ms weather-only handoff. No top-level browser side effects.

Shared player and circular display are in `../referenceScene/`. Personal content
belongs in `../profile/`, never in the renderer. Full instructions and current QA:
[poetic-pixel.md](../../../docs/guides/poetic-pixel.md).
