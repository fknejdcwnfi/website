# AGENTS.md

This repository is **fknejdcwnfi's personal website** with a Minecraft-inspired
pixel visual language. The owner explicitly clarified on 2026-10-28 that it must
be a complete, clean personal site with navigation, introduction, real projects,
contact details and a footer. Vermouth is the hero artwork, not the whole site.
The character remains a faithful 2D pixel portrait, not a Steve / 3D voxel redesign.

If you are Codex Cloud or another coding agent, read this file first, then the
documents listed below. Do not start coding before you understand the hard rules.

---

## Read in this order

0. Read [`docs/guides/reliable-motion.md`](docs/guides/reliable-motion.md) first for the current precomputed default, motion consent and startup behavior.

0. [`docs/guides/video-layered-rebuild.md`](docs/guides/video-layered-rebuild.md) — latest uploaded-video-driven cutout/mesh reconstruction
1. [`docs/guides/reference-rebuild.md`](docs/guides/reference-rebuild.md) — prior document layout and rejected field-animation baseline
2. [`docs/guides/personal-site.md`](docs/guides/personal-site.md) — website and personalization contract
3. [`docs/guides/living-portrait.md`](docs/guides/living-portrait.md) — identity and pixel presentation
4. [`docs/guides/reference-wind.md`](docs/guides/reference-wind.md) — historical visible-wind baseline
5. [`docs/guides/development.md`](docs/guides/development.md) — commands and deployment
6. [`docs/guides/asset-inventory.md`](docs/guides/asset-inventory.md) — provenance and limitations
7. [`docs/decisions.md`](docs/decisions.md) — decision history

`docs/archive/` contains dated earlier stages, not the current implementation contract.

`docs/reference/**` is frozen: read it for intent, never edit it.

---

## Hard rules

- **`assets/source/**` is read-only.** Never overwrite, crop, re-encode, rename,
  or delete the original frames, reference image, contact sheet, or GIF.
- **`original_reference.jpg` is the highest identity and framing authority.**
  Preserve its pointed chin, tilted blue eyes, confident smirk, asymmetrical
  curling platinum hair, shoulder crop, long sapphire earrings and low pendant.
  Frames 01–10 supply motion intent only; do not copy their inconsistent faces.
  Immutable frame_01 / frame_10 must remain byte-identical.
- **Never present the cross-fade as a finished seamless animation.** It remains
  an explicitly provisional legacy preview.
- **Use faithful 2D pixel art, not Steve anatomy or a 3D voxel redesign.**
  ADR-015 and the living-portrait guide supersede the previous voxel default and its framing.
  AI-assisted artwork is authorized, but use one canonical pixel face and only
  local eyelid materials; never switch independently generated faces per frame.
- **A complete personal website is required.** Navigation, personal introduction,
  real projects, contact links and footer are required.
  The former character-only / no-UI restriction is superseded by ADR-016.
  The normal homepage has no public play/pause controls: hair moves continuously
  on a reference-driven 12000 ms physical cycle while visible, with a separate 24000 ms blink schedule. Keep manual controls opt-in via debug=1 or
  explicit QA parameters; honor reduced motion and visibility suspension. Only when system reduced motion is active, explain the static state and allow explicit visitor opt-in with a reversible local choice; normal playback has no controls.
- **Use a centered, circular, borderless portrait presentation.** The owner's latest
  2026-10-29 request supersedes the earlier unclipped silhouette presentation.
  Clip only the display viewport; keep the original close-up composition, canonical
  artwork and transparent materials intact. Do not add a circular stroke, frame,
  thick background, rectangular card or full-bust outpainting. Raw Canvas pixels
  retain binary alpha; the browser's circular clipping edge may be antialiased.
- **Keep pixel art crisp.** Disable image smoothing and use nearest-neighbor display.
  Align the displayed grid to integer physical-device-pixel multiples when space
  permits; respond to viewport / DPR changes without per-frame layout work.
- Keep personal content in `src/features/profile/content/site.ts` and shared layout in `SiteShell`.
  Use owner-provided name fknejdcwnfi, greeting HELLOWORLD and the supplied email;
  never invent credentials, employment, project claims or social accounts.
- **No whole-image translate/rotate/scale** to fake hair motion or blinking.
- Keep the pixel character's facial geometry stable during animation. Eyelids,
  hair and jewelry move locally; do not substitute other generated faces.
- **Do not disable or break `.github/workflows/deploy.yml` or `ci.yml`.**
  Pushes/merges to `main` auto-deploy to GitHub Pages. Modifying workflows
  requires a GitHub connection with `workflow` permission.
- **Do not run `npm run deploy`** (the `gh-pages` fallback) without the owner's
  explicit approval. Normal deployment happens automatically on `main`.
- **Keep `npm run build` and `npm run typecheck` green.**
- **Update `docs/` and `CHANGELOG.md`** whenever behavior changes.
- **Be honest about limitations.** “Not verified” must never be written as “done”.

---

## Commands

```bash
npm ci
npm run dev
npm run test
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
```

Visual QA:

```text
http://localhost:5173/                  # complete personal homepage
http://localhost:4173/website/          # preview after build
http://localhost:4173/website/?view=portrait&theme=emerald&debug=1
http://localhost:4173/website/?view=portrait&pose=5  # isolated portrait QA
```

Deployment is automatic: pushing/merging to `main` runs
`.github/workflows/deploy.yml`. Do not run the fallback unless the owner asks:

```bash
npm run deploy   # manual fallback: builds and force-pushes dist/ to gh-pages
```

---

## Current state

- Vite 8 + React 19 + TypeScript 7; Canvas 2D player.
- Default: responsive personal homepage with an indigo double header, white document
  layout, left navigation, right contents, local search, about, real project table and contact sections; editable content and shared site shell.
- Hero / isolated view=portrait: rebuilt independent canonical cutouts bound to their
  own arc-length spines and forward skeletal triangle meshes. Sixteen-node XPBD
  rods use 240 Hz constrained steps, three warmup cycles and a 120 Hz world-pose
  cache. The default physical parameters load an integrity-checked precomputed cycle without a Worker; non-default parameters and cache-load failure use a Worker. Runtime interpolates nodes at rAF cadence. The
  field/inverse-map renderer is archived in `src/archive/fieldPortrait/`.
- Eight current complete hair materials, canonical face/body clean plate, original local
  eyelids and independently pivoting complete earrings. The 12-second wind contains
  two six-second reference-scale gust phrases. The accepted 24-second blink clock
  remains at 4400/11300/20300 ms with 280 ms events.
- Reduced motion, poses1/10, wind0 and direction0 paint canonical pixels immediately
  without starting a physics Worker. Wind0 still retains independent blinking.
  Hidden/offscreen suspension preserves phase; asynchronous preparation generations
  prevent outdated configuration results/errors from replacing a newer rig.
- New natural portrait masters are in `assets/generated/portrait-v4/`; authoring
  grids are in `public/assets/portrait-natural/`; normal Player reads byte-exact
  baked `public/assets/portrait-rig/rig-{size}.json/png` without runtime segmentation. The transparent static
  fallback is `public/portrait-rest.png` at 768²; OG composition remains separate.
- Archived modes: ?style=voxel retains the prior block bust; ?style=legacy
  retains the ten-pose provisional anime cross-fade.
- Immutable source assets; WebP derivatives generated by `scripts/assets/optimize_assets.py`.
- `src/app` composes the site; `src/features/profile` owns content/UI;
  `src/features/portrait` owns the rig; shared types live in `src/shared`.
  Archived players load only for explicit historical modes. See `scripts/README.md`.
- `socials` and `gameProfiles` in site.ts are optional typed extensions. Render only
  verified owner content; empty configurations must not show placeholder accounts or dead links.
- Static initial HTML and error fallbacks preserve content when the app fails;
  reduced-motion support and URL debug switches remain.
- Live at <https://fknejdcwnfi.github.io/website/> via GitHub Actions;
  the historical `gh-pages` commit is preserved under the archive/2026-10-29/gh-pages tag.
  The explicitly requested manual fallback can recreate that branch; normal publishing uses main.
- Normal t=0 is a flowing breeze pose, not a forced rest frame. Explicit pose1/10
  and reduced motion preserve the canonical static rest view. wind=0 suppresses
  hair/jewelry motion while the independent eye schedule continues. Keep all delayed
  strand/recoil samples periodic; never reintroduce settling windows at the seam.
- Current reconstruction evidence lives in `artifacts/video-layered/`;
  `artifacts/reference-rebuild/` records PR9, whose hair effect the owner rejected;
  `artifacts/flowing-hair/` records the previous visible-hair baseline;
  `artifacts/gentle-portrait/` records PR7 before the stronger circle-visible flow,
  and `artifacts/pixel-world/` records the earlier fast gust. Never cite historical
  measurements as current verification.
- Verify hair motion within the visible circular crop, including face-side locks
  and long-curl midsections. Whole-Canvas texture differences or off-crop peaks
  alone do not establish that the owner can see flowing hair. Preserve the approved
  independent blink behavior when refining wind.
- The layered clean plate uses retained underpaint and local hidden-surface repair; full source-identical
  face/shoulder layer reconstruction remains constrained. Do not claim complete
  layered art, source-identical geometry, perfect likeness or unmeasured QA.

## Suggested next task

Continue `docs/guides/personal-site.md` for website content, accessibility, responsive
layout and availability. Use the living-portrait and reference-wind guides for fidelity and animation. Preserve
the owner's personalization choices and keep future sections independent of the
rig. Do not add fake content or inactive feature controls. Use the existing
isolated checkout, without a worktree unless the user explicitly requests one.

## Delivery checklist

- One PR, one concern.
- Include commands run, screenshots (or why they were impossible), and known limitations.
- Update `CHANGELOG.md` and affected docs.
- The owner authorized automatic merging on 2026-10-28 for this and future tasks.
  Once required CI and change-relevant validation pass and no merge blockers
  remain, merge the task PR and verify the resulting Pages deployment without
  requesting routine confirmation. Honor newer task-specific instructions.
  This supersedes older merge-only restrictions in task examples; it does not
  authorize skipping checks, bypassing branch protection, expanding task scope,
  or accepting unresolved asset and architecture decisions.
- A newer explicit hold on publishing overrides the standing auto-merge policy.
  Complete reviewable changes and validation locally while such a hold is active;
  do not push, merge, deploy or publish an environment until authorization resumes.
- **Authorization resumed on 2026-10-29:** the owner explicitly requested
  automatic merging and website updates together with richer reference-driven
  hair/wind/blink motion. After review and passing checks, open and merge the PR,
  then verify GitHub Actions / Pages; no routine confirmation is needed.
- Merging to `main` triggers the Pages deployment; verify the Actions run.
- Keep main as the permanent branch. After merging, remove the task branch only
  after checking its published tree; archive superseded unique commits before cleanup.
  See `docs/maintenance/branch-cleanup.json` for the 2026-10-29 cleanup and recovery refs.

If blocked, stop and report:

```text
STOPPED: <one-line reason>
Done: <...>
Not done: <...>
Needs owner decision: <specific question with options>
```
