# Borderless close-up Vermouth · v4

Retained AI-assisted image edits; original sources in `assets/source/` are untouched.

- `open.png`: background-removal edit from `assets/generated/portrait-v2/open.png`. Original square close-up scale, cropped top hair and shoulders preserved. Navy exterior and gaps between curls become transparent. No outpaint or full-bust redesign.
- `closed.png`: local closed-eye donor edited from this transparent open master. Runtime samples only its two eye polygons; the remaining face/body/hair always comes from `open.png`.

Tool outputs were copied unchanged from `/workspace/generated_images/exec-cd5ad194-150e-48c0-9618-42fc3f809254.png` and `exec-88550433-46e6-4375-9ebd-943b0814c0ad.png`. Browser export normalizes into 42 palette colors with binary alpha at widths192/256/320; all retain original1:1 close-up composition. Root `portrait-rest.png` is the same resting raster at768², with transparent exterior. `og-portrait.png` is separately composited on the website paper background for social preview. This AI-assisted derivative is not a source-identical geometry certification.

The rejected full-bust experiment is not used by the website or included as final art. See `PROMPTS.md`, `public/assets/portrait-natural/manifest.json` and `docs/guides/living-portrait.md`.
