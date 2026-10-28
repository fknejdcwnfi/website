# Changelog

本專案遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) 的精神，
版本號使用 `MAJOR.MINOR.PATCH`。

## [Unreleased]

### Planned

- Stage 2：圖層規劃、遮罩、clean plate 與補繪。
- Stage 3：PixiJS／WebGL 網格 rig、七組髮絲風力。
- Stage 4：眼皮圖層、220 ms 眨眼、耳環鐘擺。
- 視覺回歸測試（Playwright）與時間軸單元測試（Vitest）。
- 自訂網域評估。

---

## [0.1.0] - 2026-10-28

第一個可部署的公開版本：**Stage 1 · Key-Pose Preview**。

### Added

- Vite 8 + React 19 + TypeScript 7 專案骨架。
- 深色單舞台視覺：正方形角色舞台、光暈、暗角、進場動畫。
- Canvas 2D 播放器：十幀關鍵姿態、2300 ms 循環、段落尾端交叉淡入。
- 時間軸資料：時間、風力、眼睛開合、姿態標籤。
- URL 除錯參數：`?debug=1`、`?pose=1..10`。
- `prefers-reduced-motion` 支援：靜止於第 1 幀。
- 分頁隱藏時暫停、回到前景續播並保留相位。
- 響應式舞台（92vmin，手機 94vmin）與安全區支援。
- 素材管線 `scripts/optimize_assets.py`：1080² WebP、manifest、1200×630 OG 圖。
- 原始素材清冊、時間軸規格、目標架構、開發指南、Codex 交接、QA 清單與 ADR。
- 根目錄 `AGENTS.md`：Codex Cloud 自動載入的代理規則與閱讀順序。
- GitHub Pages 自動部署：推送 `main` 由 `.github/workflows/deploy.yml` 建置與發佈。
- PR 建置檢查：`.github/workflows/ci.yml`。
- `npm run deploy` 保留為 `gh-pages` 手動備援。
- `favicon.svg`（藍寶石墜飾）與 OG metadata。
- `scripts/verify_assets.py` 與 `npm run assets:verify`：驗證 manifest 雜湊、第 1/10 幀一致與必要靜態檔；CI 與部署 workflow 都會執行。
- SEO 收尾：canonical、`og:site_name`、`og:image:alt`、Twitter metadata、`robots.txt`、`sitemap.xml`。

### Changed

- 將原本扁平的 `vermouth_10frame_animation_refined/` 重構為 `assets/source/`、`public/assets/`、`src/`、`docs/`、`scripts/`。
- 原始 PNG 不再直接提供給瀏覽器；改由 WebP 衍生檔服務（約 16.9 MB → 1.4 MB）。
- 原始 prompt 文件移入 `docs/reference/`，凍結保存。
- GitHub Pages 由 `gh-pages` 分支切換為 GitHub Actions（`build_type: workflow`）；`gh-pages` 保留為手動備援。
- 抽出 `src/animation/timeline.ts`：純時間軸取樣，不依賴 DOM／Vite，方便日後單元測試。
- 播放器在 `prefers-reduced-motion` 或 `?pose=N` 靜止時停止 rAF，不再以 60 fps 重畫同一幀。

### Removed

- Windows `:Zone.Identifier` 附加檔案。
- 空的原始資料夾結構。

### Verified

- `npm ci`、`npm run typecheck`、`npm run build`、`npm run assets:check` 通過。
- 推送 `main` 後 `Deploy to GitHub Pages` Actions 成功（run `40651840016`）。
- Pages build type 為 `workflow`；網站與 `frame_01.webp` 回傳 200。
- `npm run deploy` 曾成功將 production build 發佈到 `gh-pages`（目前為備援）。
- GitHub Pages 回傳 200；production 的 `?pose=5` 與 `?pose=10` 幀比對通過。
- production build 的資源路徑為 `/website/`。
- 以 headless Chromium 截圖驗證桌面 1200×1000 與手機 390×844（DPR 2）。
- `?pose=5` 凍結與 `?debug=1` 狀態顯示正常。
- `prefers-reduced-motion` 下畫面靜止且與第 1 幀一致。

### Known limitations

- 交叉淡入不一致的 AI 幀可能產生殘影與身份漂移。
- 尚未分層，無法做真正的髮絲與眼皮變形。
- 04／05 幀原始解析度為 1254²，與其他幀不同。
- 尚無自動化視覺回歸測試。

---

## 版本規則

- `MAJOR`：舞臺結構或視覺語言重大變更（例如從單角色改為多角色）。
- `MINOR`：新增階段能力（Stage 2、3、4）或可見功能。
- `PATCH`：修正、文件、效能、無視覺變更的重構。

Stage 1 → Stage 2 的素材與架構變更應記為 `MINOR`，即使畫面暫時不變。