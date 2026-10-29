# Reference layout and coupled strand dynamics

Current evidence for the 2026-10-29 refactor. Earlier directories are historical and are not overwritten.

- `site/checks.json`: 84 production-site behavior, responsive, pixel-presentation and fallback checks. Screenshots show the clean initial UI with reduced motion, as recorded in JSON.
- `qa.json`: 58 development-source rig/player checks, including fixed pixels, roots, eyes, palette, alpha, visible circular hair, seams and refresh-independent timing.
- `raster-cache.json`: 180 pixel-exact comparisons of reachable candidates with the original full candidate field, across three grids, six configurations and ten phases. Reproduce with `scripts/qa/verify_raster_cache.py`.
- `baseline-performance.json`: the unchanged main version measured in the same environment before editing.
- `performance.json`: final production measurement, native and unconstrained, one fresh browser/page per run, 1200×1000, DPR1, 2.5-second warmup and full 12-second samples. No screenshots or other browser work during measurements. Preserve observed scheduling variance.
- `performance-native-repeat.json`: one native repeat after the initial p95 regression; retain both results and scheduling outliers, rather than replacing the first measurement.
- `portrait/`: actual production-player frame exports and a circular 24-second animated preview. Controlled timestamps and GIF encoding are visual evidence, not real-time FPS measurements.

No source assets, canonical materials or production dependencies were replaced. The physical model is bounded 2D coupled spring deformation, not full 3D hair/fluid simulation. Physical high-refresh displays were not measured. Full commands and results are in `docs/guides/reference-rebuild.md`.
