# Complete personal website draft

This is the new full personal website, separate from the historical portrait-only screenshots.

- `hero.png`: desktop first view.
- `desktop.png`: full1440px desktop page.
- `mobile.png`: full390px mobile page (DPR1 screenshots;DPR2 also exercised by the portrait regression suite).
- `no-javascript.png`: usable personal content with JavaScript disabled.
- `checks.json`:34production-page checks; injectedfailurecases are expected and listed separately from normal-page errors.
- `performance.json`: freshsingle-pageproduction sample,5seconds,300paints/60fps,callbackCPUmedian0.6ms/p951.1ms,no longtasks. Not physical-device certification.

Screenshots use reduced motion for stable visual review. Normal playback,pause/resume,viewport suspension and static-mode indicators were checked independently.

Reproduce from the repository root:

```bash
npm run build
npm run preview
python3 scripts/verify_personal_site.py --url http://127.0.0.1:4173/website/
python3 scripts/measure_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/personal-site/performance.json
```

The current draft has not been pushed, merged or published. The public website remains the previous version until the owner's publishing hold is explicitly lifted.
