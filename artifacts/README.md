# Living portrait verification artifacts

All pixel frames are exports of the actual website Canvas, not unused AI candidates.
The original reference remains unchanged in `assets/source/original_reference.jpg`.

- `pixel_reference.png`:256² runtime portrait at0ms.
- `pixel_frame_01.png`…`pixel_frame_10.png`: exact timeline seeks0,230,460,630,740,850,1020,1300,1570,1890ms.
- `comparison.png`: original reference alongside runtime rest, gust and closed-eye frames.
- `animation_preview.gif`:67 actual timeline samples, optimized to40encodedframes,2300ms total. This is deterministic timeline playback, not a realtime FPS benchmark.
- `desktop.png` and `mobile.png`: complete production-page screenshots; mobile390×844,DPR2.
- `capture.json`: capture provenance, reference hashes and GIF metadata.
- `qa.json`:33functional/browser/regression checks and pixel invariance counts.
- `performance.json`: isolated production measurement; read its conditions and limitations before drawing device-performance conclusions.

Reproduce from the repository root using Node24 and the provided cloud Python/Chromium tools:

```bash
npm test
npm run build
npm run assets:verify
npm run dev
# In another terminal, using the dev URL:
python3 scripts/verify_portrait_browser.py --url http://127.0.0.1:5173/
# To refresh runtime assets from the retained pixel-art masters:
python3 scripts/export_portrait.py --url http://127.0.0.1:5173/
# Start production preview after building, then capture/measure its actual route:
npm run preview
python3 scripts/capture_portrait.py --url http://127.0.0.1:4173/website/
python3 scripts/measure_portrait.py --url http://127.0.0.1:4173/website/
```

The browser script probes source modules and therefore uses the Vite dev server.
Capture and performance scripts also support production preview. The optional
Python tools require Playwright/Pillow/Chromium; core npm build/tests do not.
Retained AI-assisted masters preserve one artistic interpretation. Neither these
artifacts nor the hashes certify exact original facial geometry or subjective
perfection across every display.
