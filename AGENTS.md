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

0. [`docs/guides/reference-rebuild.md`](docs/guides/reference-rebuild.md) — latest blue document layout and physical-strand refactor
1. [`docs/guides/personal-site.md`](docs/guides/personal-site.md) — current website and personalization contract
2. [`docs/guides/living-portrait.md`](docs/guides/living-portrait.md) — portrait subsystem contract
3. [`docs/guides/reference-wind.md`](docs/guides/reference-wind.md) — prior visible-wind baseline and measured evidence
4. [`docs/guides/development.md`](docs/guides/development.md) — architecture, commands and deployment
5. [`docs/guides/asset-inventory.md`](docs/guides/asset-inventory.md) — provenance and limitations
6. [`docs/decisions.md`](docs/decisions.md) — decision history

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
  on a gentle 12000 ms cycle while visible, with a separate 24000 ms blink schedule. Keep manual controls opt-in via debug=1 or
  explicit QA parameters; honor reduced motion and visibility suspension.
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
- Hero / isolated view=portrait: canonical 2D pixel portrait with bounded local
  hair layers with 17 coupled damped-spring stations per lock, C1 Hermite curves,
  reachable raster-span caches, hidden underpaint repair, eyelids
  and separately delayed left/right jewelry. Transparent256² grid, with
  192² and 320² alternatives; continuous 12000 ms gentle wind while
  visible, with independent 280 ms blinks at 4400/11300/20300 ms in a 24000 ms schedule. Hidden/offscreen suspension preserves phase; reduced motion and
  explicit pause/t/pose retain static behavior.
- New natural portrait masters are in `assets/generated/portrait-v4/`; runtime
  materials are in `public/assets/portrait-natural/`. The transparent static
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
- Current refactor evidence lives in `artifacts/reference-rebuild/`;
  `artifacts/flowing-hair/` records the previous visible-hair baseline;
  `artifacts/gentle-portrait/` records PR7 before the stronger circle-visible flow,
  and `artifacts/pixel-world/` records the earlier fast gust. Never cite historical
  measurements as current verification.
- Verify hair motion within the visible circular crop, including face-side locks
  and long-curl midsections. Whole-Canvas texture differences or off-crop peaks
  alone do not establish that the owner can see flowing hair. Preserve the approved
  independent blink behavior when refining wind.
- The new underpaint only repairs local hair occlusion; full source-identical
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
