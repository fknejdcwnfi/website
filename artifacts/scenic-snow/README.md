# Current Minecraft scenic reconstruction evidence

`site/` and `preview/` show the current single-master Minecraft portrait, full outer landscape and216-particle snowfall. The preview uses controlled timestamps and is not physical display FPS evidence; real video autoplay and phase handoff are separately measured by `progressive-start.json`. `performance.json` uses a fresh native browser with no screenshots or parallel browsers.

`original-source-assets.json` proves the original reference inputs/atlases remain intact. New styled pixels deliberately differ. `motion-fields.json` records constrained source retargeting and visibility within the circular crop; generated fields remain an estimate, not source-identical geometry.

`pixel-reconstruction-study/` contains the earlier original-anime nearest/Scale2x/HQx authoring comparison. Those are algorithm studies, not the new Minecraft artwork or current performance results. `bootstrap-dom.json` is a mocked DOM lifecycle fixture; do not use it instead of the real media test.
