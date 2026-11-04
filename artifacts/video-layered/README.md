# Video-driven layered portrait reconstruction

Current evidence for the rebuilt canonical cutout / arc-length mesh renderer.

- `reference/`: uploaded-video keyframes, camera registration and bounded motion analysis. The reference itself changes facial geometry; only hair motion informs the implementation.
- `qa.json`: final 61/61 checks, including full source/bake equality at three sizes, true restmesh reconstruction, palette/alpha, central features, eyelids, physical nodes, positive mesh area, castshadow clipping, refresh-independent timing, lazy worker startup, failure fallback and lifecycle.
- `site/checks.json`: final 84/84 production-site checks with real baked-image failure interception; desktop/mobile/no-JavaScript screenshots.
- `baseline-performance.json`, `performance.json`: fresh single-page native/unconstrained production measurements, no screenshot or other browser work during timed sampling. Physical high-refresh displays are not measured.
- `startup.json`, `diagnostics/startup-before-bake.json`: startup measured separately; slow material splitting was removed from visitor startup, remaining long tasks are retained honestly.
- `portrait/`: 24-second 480-frame circular GIF, exact raw Canvas exports/keyframes, comparison/gallery and a 12-second 720-frame 60-fps H264 review video from actual production CSS screenshots. Neither encoding rate establishes physical refresh rate. PNGs remain pixel authority.
- `mesh-area-projection.json`: independent 1440-phase mesh sweep; local positive-area constraints correct only three vertices by at most 0.521 logical pixels without shrinking the lock or dropping triangles.

Early diagnostic failures are preserved as named `qa-before-*` / first-pass files. They are not current passing evidence. The original 1.1MB generated selection matte is kept under assets/generated, not downloaded by visitors; normal rendering reads lossless baked layers. Visible colors and identity always originate in retained canonical artwork.
