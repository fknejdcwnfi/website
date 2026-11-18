# 2026-11-18 · 独立思绪空间

This evidence records a separate public “思绪” section, edited article and its
production-preview checks. It uses the site's shared native writing card, local
pixel font and scenic theme. The portrait renderer and Minecraft scenery are
unchanged. The original DOCX and its metadata are not in the repository or build.

The public article preserves the author's thoughts about change, missed chances,
loneliness, the cat 三色, relationships and next steps. Personal names and
third-party details have been generalized; contact and location clues and exact
private schedules were left out. Long supplied game dialogue was summarized.
The full text is public when a visitor opens the article; `<details>` is not
private storage.

## Production-preview checks

- `npm run build`: TypeScript check and 161 Node tests passed; root production
  bundle built successfully.
- GitHub Pages base build (`/website/`): built successfully from the same source.
- [root journal report](root/journal/checks.json): 40 browser checks passed;
  [Pages journal report](pages/journal/checks.json): the same 40 passed under `/website/`.
- [root theme report](root/theme/checks.json) and
  [Pages theme report](pages/theme/checks.json): 24 reading-theme,
  mobile-width, no-JavaScript and character-retention checks passed per build.
- [root UI report](root/cream-ui/checks.json) and
  [Pages UI report](pages/cream-ui/checks.json): 160 visual,
  font, local-image, navigation, layout and stable-scene checks passed per build.
- [profile module report](root/profile-modules/checks.json): 290 checks passed for the eight destinations,
  the preserved animated portrait and existing project modules.
- [Pages security report](pages/security/checks.json): 118 local CSP and browser-failure checks
  passed, including blocked inline script/handler attempts and Thoughts search.
- Preview captures: [desktop card](root/journal/thought-card.png),
  [mobile card at 375px](root/journal/thought-card-mobile.png).
- Font coverage passed with the preserved full font and a 30,396-byte startup
  subset covering 957 codepoints (958 glyphs).

## Scope and limits

The static bundles include a 317.80 kB JavaScript bundle (103.27 kB gzip) and
77.21 kB CSS (17.26 kB gzip). These are build measurements, not field Core Web
Vitals or a claim about visitor hardware. No application dependencies changed.
`npm ls --omit=dev --depth=0` resolves the two runtime packages. `npm audit`
could not reach the npm security advisory service: the registry returned HTTP
403, so dependency-advisory status remains unverified.

Automated browser and source checks are evidence for the tested build and
Chromium environment; they are not a proof of absolute security. Full reports
remain in this directory; redundant full-scene screenshots were removed to keep
the repository small.
