# Uploaded reference video: motion analysis

This is analysis only. It does not change application code or source artwork.

## Observed media

- H.264, 544 × 544, 24 frames/s, 145 frames, 6.041667 seconds; AAC audio and an attached poster are also present.
- SHA-256: `2c1765e77e79e143c0b6e3c9e5ea6ee9d3925cf59bd8701868139f125489f827`.
- All 145 actual video frames were extracted locally under `work/video-rebuild/analysis/frames/`; only the keyframe sheets and bounded measurements are versioned here. The attached poster stream was not mistaken for animation.
- `contact-sheet.png` contains 13 unregistered keyframes; `registered-contact-sheet.png` shows the same times after eye-centered similarity registration into the 1.0-second frame.

## Separate camera/identity drift from hair movement

Video eye distance goes from 151.74 to 138.59 source pixels (8.67% smaller), with eye midpoint drift (+8.76,+16.05) source pixels. Registration removes this approximate scale, translation and eye-line rotation. Interpolated eye centers bridge blink frames. The generated reference still changes facial geometry, shading and shoulder anatomy; those changes are not authorized material for a face animation.

Even after this registration, hair movement remains large and obvious. Long side sheets fan outward, curl centers rise, gaps between locks change, and portions leave the source crop. Therefore a whole-image transform, independently generated frame sequence, or camera zoom would reproduce the wrong part of the reference.

## Motion timing, visually inspected

| Time | Visible action |
| --- | --- |
| 0.00–0.70 s | Initial wind, first blink, local hair continues moving during closure. |
| 0.70–1.50 s | Long locks begin separating from the neck/shoulder; middle portions start opening outward. |
| 1.50–2.70 s | Broad side sheets fan to both sides, larger curves open, free ends lift toward horizontal and several leave the crop. This is the first strong gust. |
| 2.70–3.40 s | Hair falls and recoils; the lower curls reform while middle and ends return at different times. |
| 3.70–4.40 s | A second strong outward flare opens the long sheets again, with visible bend rather than rigid translation. |
| 4.40–5.20 s | Gradual settling with curls and separated strips returning. |
| 5.30–5.70 s | Second blink while hair continues. |
| 5.70–6.04 s | Return toward a quieter configuration; the final image does not match the initial image, so this video is not a ready seamless loop. |

The cyan-iris connected-component probe finds nearly closed/closed intervals at 0.333–0.542 s and 5.375–5.542 s. These intervals are approximate and are not an instruction to replace the already accepted blink clock. The source itself is 24 fps; it cannot establish a 120/144/240 Hz implementation.

## Why the current portrait fails this reference

- Its approximately 7 logical-pixel visible long-curl motion remains a small local bend, while the reference opens broad hair sheets and silhouette gaps across tens of source pixels after head registration.
- Row/y-based station phase is unsuitable for S-shaped curl centerlines: two points on the same world row can lie at different arc positions along a real lock.
- The current group masks and local underpaint are patches inside a largely fixed close-up, not complete, separately ordered hair sheets. Raising the same displacement constants risks seams, repeated texture, skin contamination and missing hidden art.
- A pure shared sine translation cannot produce root-to-middle-to-tip propagation, curl orientation change, changing gaps and layered overlap.
- The source includes outward movement on both sides. It must not be misread as a single uniform horizontal wind translating every strip in the same direction.

## Rebuild targets

Use one fixed canonical face/body plate with complete extracted/repaired front and back hair sheets. Bind each sheet to its own arc-length centerline or ribbon mesh, with anchored proximal nodes, material length and curvature constraints, drag, damping and a small art-directed outward response. Separate forelocks, side sheets, shoulder curls and free wisps. Preserve the approved local eyelids independently. A small typed-array solver and nearest-neighbor GPU raster at the logical grid are appropriate; a new language alone does not create the missing sheet topology or hidden art.

Suggested meaningful acceptance, in addition to existing pixel/availability checks:

1. Show actual, same-crop side-by-side reference and app motion at quiet, gust-rise, full flare and return. Compare local hair motion after fixing the face, not whole-image texture differences.
2. At least the main side/shoulder sheets visibly change angle and curvature and open/close gaps in the circular crop; a large peak outside the crop does not pass.
3. Track named root/middle/end landmarks along arc length. Roots remain fixed, middle starts first, ends follow; return exhibits delayed recoil without length explosion. Do not claim measured video lag constants from this analysis: no reliable dense optical flow package is available here.
4. Broad hair motion continues through both blink events, and stable face/neck/pendant geometry remains fixed underneath legitimate foreground occlusion.
5. Test mesh/strip folds, unintended holes, order crossings, exposed hidden plates, binary alpha and palette. Fixed facial feature pixels should be separated from legal hair occlusion rather than pinning all forehead hair to satisfy a broad old face mask.
6. Preserve a periodic runtime loop using a smooth motion field; do not claim the supplied video already has a seamless endpoint. A 12-second composition can contain two art-directed gust phrases at the video’s timescale rather than time-stretching one short movement into imperceptible micro-sway.
7. Verify actual production rAF and render cost separately from 24-fps source frames and GIF slots. Keep phase independent of display refresh and honor hidden/offscreen/reduced-motion behavior.

## Evidence limits

`registered-metrics.json` includes regional RGB appearance changes after registration. These are not optical-flow displacement or proof of local motion: the generated video also changes shading and art geometry. The exact local hair displacement and phase lag are not reported as measured quantities. The qualitative timing above was verified by inspecting the actual frame images.
