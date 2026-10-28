# 貢獻指南

本專案是一個人網站作品，變更以「不破壞角色身份與視覺品質」為最高原則。
在動手前，請先讀 [目前Living Portrait契約](docs/11-living-portrait.md)、[文件閱讀指南](docs/README.md) 與 [Codex 交接](docs/06-codex-handoff.md)。目前預設為忠於original_reference的Minecraft-inspired 2D像素立繪；ADR-015取代前次方頭voxel解讀，不能恢復Steve／3D造型。

---

## 快速流程

```bash
npm ci
npm run dev
# 修改
npm test
npm run typecheck
npm run build
npm run assets:check
```

部署：推送或合併到 `main` 後由 GitHub Actions 自動建置與發佈。
`npm run deploy` 是手動備援，會 force push `gh-pages`，需擁有者同意。

視覺變更請附上：

- `?pose=1`、`?pose=5`、`?pose=7` 的截圖。
- 完整循環的短錄影或 GIF。
- 受影響的裝置尺寸（至少 1200×1000 與 390×844）。

---

## 可以改什麼

- `src/**`：前端程式與樣式。
- `docs/**`：文件（`docs/reference/**` 除外）。
- `scripts/**`：素材管線與部署備援腳本。
- `.github/workflows/**`：CI 與 Pages 自動部署（需 `workflow` 權限）。
- `package.json`：依賴（需說明理由）。
- `assets/generated/**`、`public/assets/rig/**`：新的生成物（需登記）。

## 不可以改什麼

- `assets/source/**`：唯讀。不得覆寫、裁切、重新編碼。
- `docs/reference/**`：凍結。不得改寫原始委託文件。
- original_reference的身份、神態與近景構圖基準。
- 舞臺的「只有角色」原則（未有新內容需求前不加入常駐UI）；2D像素造型與乾淨深色背景依目前契約開發，不加入無關場景。
- 不得把交叉淡入描述成完成品。

---

## 提交規範

使用 Conventional Commits：

```text
feat: add layered hair rig
fix: keep loop seamless after tab restore
docs: document wind parameters
refactor: extract timeline sampler
chore: update vite
```

- 一個提交一件事。
- 必要CI與本次相關驗證通過、無阻擋後自動合併PR，並確認Pages部署；擁有者已授權，不逐次詢問。
- 不要提交 `node_modules/`、`dist/`、`*.tsbuildinfo`、暫存截圖。
- 不要 force push 到 `main`。
- CI 失敗時先修 CI。

---

## PR 檢查清單

- [ ] 動機與範圍清楚。
- [ ] `npm run build`、`npm run typecheck` 通過。
- [ ] 沒有修改 `assets/source/**`。
- [ ] 沒有加入未說明的依賴。
- [ ] 視覺變更附 before／after。
- [ ] 文件與 `CHANGELOG.md` 已更新。
- [ ] 已知限制誠實列出。

完整驗收請見 [QA 檢查表](docs/07-qa-checklist.md)。

---

## 權利提醒

角色與素材權利不屬於本專案。請勿將任何角色圖像用於商業用途、再散布或模型訓練。
詳見 [素材清冊](docs/02-asset-inventory.md#權利與使用範圍)。