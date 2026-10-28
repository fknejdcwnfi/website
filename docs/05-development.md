# 05 · 開發指南

> **目前預設**：Minecraft風格像素舞台；完整選項、架構與驗收見 [10 像素舞台](10-pixel-stage.md)。舊原圖預覽改用 `?style=legacy`，其素材重建與部署指令仍保留。

## 像素舞台開發入口

建置與測試需要Node24（`.nvmrc`），使用現有checkout；Node內建測試執行器不另安裝框架。先執行 `npm ci`，再跑 `npm test`、`npm run typecheck`、`npm run build`、`npm run assets:check`、`npm run assets:verify`。`npm run build`的prebuild會先執行八個內建單元檢查，現有CI亦沿用此流程。

開發伺服器：`npm run dev`，base `/`。production：`npm run build`後執行`npm run preview`，base `/website/`。新預設URL範例為 `?theme=emerald&wind=0.35&speed=0.75&seed=42`；`?pose=5&debug=1`凍結像素角色，`?style=legacy&pose=5&debug=1`檢查舊閉眼圖。

`theme`支援midnight／emerald／amethyst；`wind`為0–1；`speed`為0.25–2；`seed`為uint32。預設值為midnight／0.65／1／7。所有URL輸入須先驗證；詳細範圍與靜止語義以現行契約為準。

預設renderer不需Pillow或影像資源；Pillow仍是既有 `assets:check`／素材重建所需。`npm run assets`不產生程序化角色，不為調整像素外觀而覆寫舊WebP或原始PNG。

- **狀態**：Stage 1 可執行、可部署
- **最後更新**：2026-10-28
- **適用對象**：本機開發者、Codex Cloud、維護者

---

## 1. 環境需求

| 工具 | 版本 | 用途 | 備註 |
| --- | --- | --- | --- |
| Node.js | **24+** | Vite／React與內建TypeScript測試／prebuild | 見 `.nvmrc` 與 engines |
| npm | 10+ | 依賴與腳本 | 本專案以 npm 12 驗證 |
| Python | 3.10+ | 素材管線 | 只在重建圖片時需要 |
| Pillow | 10+ | WebP 輸出 | `python3 -m pip install Pillow` |
| Git | 2.40+ | 版本控制 | |

本機驗證環境：Ubuntu on WSL2、Node 24.20.0、npm 12.1.0、Python 3.14.4。

---

## 2. 第一次啟動

```bash
git clone https://github.com/fknejdcwnfi/website.git
cd website
nvm use            # 若使用 nvm；否則確認 node -v >= 24
npm ci             # 有 lockfile 時優先使用
npm run dev
```

開啟終端機顯示的網址，預設是 <http://localhost:5173/>。

> 開發模式的 `base` 是 `/`；production build 預設是 `/website/`。
> 因此 `npm run dev` 與 `npm run preview` 的網址不同，這是刻意設計，不是 bug。

---

## 3. 指令

| 指令 | 實際執行 | 使用時機 |
| --- | --- | --- |
| `npm run dev` | `vite` | 日常開發，熱更新 |
| `npm run build` | `tsc --noEmit && vite build` | 送出前、CI |
| `npm run preview` | `vite preview` | 檢查 production 產物 |
| `npm run typecheck` | `tsc --noEmit` | 只檢查型別 |
| `npm run deploy` | `bash scripts/deploy_gh_pages.sh` | 手動備援：建置並發佈到 `gh-pages` |
| `npm run assets` | `python3 scripts/optimize_assets.py` | 原始素材變更後 |
| `npm run assets:check` | 同上加 `--check` | 檢查衍生檔是否齊全 |
| `npm run assets:verify` | `python3 scripts/verify_assets.py` | 驗證 manifest 雜湊、第 1/10 幀一致與必要靜態檔 |

### 送出前的標準流程

```bash
npm ci
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
```

五項都通過，才進入視覺檢查（[QA 檢查表](07-qa-checklist.md)）。

---

## 4. 專案佈局

```text
src/
├─ animation/
│  ├─ keyPoses.ts        # 時間軸資料；改動前先讀 03 規格
│  └─ player.ts          # Canvas 2D 播放器；Stage 3 會替換
├─ components/
│  └─ CharacterStage.tsx # 舞台、HUD、URL 參數
├─ App.tsx               # 頁面骨架
├─ main.tsx              # React 進入點
└─ styles.css            # 全域樣式與舞台視覺
```

| 你想改… | 先看 | 再改 |
| --- | --- | --- |
| 動畫時間或風力 | [03 規格](03-animation-spec.md) | `src/animation/keyPoses.ts` |
| 播放邏輯、淡入長度 | [04 架構](04-architecture.md) | `src/animation/player.ts` |
| 舞台大小、光暈、暗角 | 本文件 §7 | `src/styles.css` |
| 除錯參數 | [03 規格 §9](03-animation-spec.md#9-除錯與量測) | `CharacterStage.tsx` |
| 素材管線 | [02 清冊](02-asset-inventory.md) | `scripts/optimize_assets.py` |
| 部署 | 本文件 §6 | `scripts/deploy_gh_pages.sh` |

---

## 5. 除錯

### 5.1 URL 參數

| 參數 | 範例 | 效果 |
| --- | --- | --- |
| `debug` | `?debug=1` | 顯示時間、姿態、混合、風力、眼睛狀態 |
| `pose` | `?pose=5` | 凍結在第 5 幀 |
| 兩者 | `?debug=1&pose=5` | 凍結並顯示數值 |

`pose` 超出 1–10 會被忽略，回到正常播放。

### 5.2 減少動態

- Chrome DevTools → **Rendering** → **Emulate CSS media feature prefers-reduced-motion: reduce**。
- 或使用 Chrome 啟動參數 `--force-prefers-reduced-motion`。
- 預期：畫面停在與第 1 幀相同的靜止狀態；`?debug=1` 仍可運作。

### 5.3 常見檢查

```bash
# 檢查 build 產物的 base path
grep -o '/website/[^"]*' dist/index.html

# 檢查衍生檔是否齊全
npm run assets:check

# 檢查原始與衍生檔的對應
python3 - <<'PY'
import json
from pathlib import Path
m = json.loads(Path('public/assets/manifest.json').read_text())
for f in m['frames']:
    print(f['source'], '->', f['file'], f['width'], f['height'])
PY
```

### 5.4 效能錄製

1. 開啟 production preview（`npm run preview`）。
2. DevTools → Performance → 錄製 5 秒完整循環。
3. 檢查：
   - 無 > 50 ms 的長任務。
   - 幀率 ≥ 55 fps。
   - 沒有反覆的圖片解碼。
4. 切換 4× CPU throttling 再測一次。

---

## 6. 部署

### 6.1 GitHub Pages（主要：GitHub Actions）

推送 `main` 後，[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
會自動建置並發佈 `dist/`。不需要手動執行部署指令。

一次性設定：

1. 進入 GitHub 倉庫 → **Settings** → **Pages**。
2. **Build and deployment → Source** 選擇 **GitHub Actions**。
3. workflow 內的 `actions/configure-pages@v5` 設定了 `enablement: true`。
   若 Pages 尚未啟用，它會啟用並使用 GitHub Actions；但若 Pages 已經是
   **legacy branch**，`enablement` 不會自動切換。此時需在
   **Settings → Pages → Source** 選擇 **GitHub Actions**，或呼叫
   `PUT /repos/{owner}/{repo}/pages` 並帶 `{"build_type":"workflow"}`。

之後每次推送 `main`：

```text
push main → npm ci → npm run build → configure-pages
         → upload-pages-artifact → deploy-pages
```

PR 會由 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) 執行建置與
`npm run assets:verify` 檢查。

相關檔案：

- `.github/workflows/deploy.yml`：`main` 自動部署。
- `.github/workflows/ci.yml`：PR 與手動觸發的建置檢查。
- `vite.config.ts`：production base path。

驗證：

```bash
# 看 Actions 是否成功（公開 repo 可匿名查詢）
curl -sS https://api.github.com/repos/fknejdcwnfi/website/actions/runs?per_page=3 \
  | python3 -c "import sys,json;[print(r['name'],r['status'],r['conclusion']) for r in json.load(sys.stdin)['workflow_runs']]"
```

網址：<https://fknejdcwnfi.github.io/website/>

> 修改 `.github/workflows/**` 需要具備 `workflow` scope 的憑證，或使用有
> Workflows 權限的 GitHub App。若推送被拒，見 §10 疑難排解。

### 6.1.1 手動備援：gh-pages 分支

若 Actions 暫時不可用，或你想在不觸發 workflow 的情況下發佈：

```bash
npm run deploy
```

指令行為（`scripts/deploy_gh_pages.sh`）：

1. 執行 `npm run build`。
2. 將 `dist/` 複製到暫存目錄，加入 `.nojekyll`。
3. 在暫存目錄建立 `gh-pages` 分支並提交。
4. 強制推送到 `origin` 的 `gh-pages` 分支。

使用備援時，Pages Source 需暫時切回：

1. **Settings → Pages → Build and deployment → Source**。
2. 選擇 **Deploy from a branch**。
3. Branch 選 **`gh-pages`**，資料夾選 **`/ (root)`**。

修好 Actions 後，記得把 Source 切回 **GitHub Actions**。
不要同時讓兩套機制部署同一個網站，以免互相覆蓋。

> `npm run deploy` 會 `git push --force` 到 `gh-pages`。這是生成分支，不要在上面直接編輯。

### 6.2 base path

| 情境 | `base` | 設定方式 |
| --- | --- | --- |
| GitHub Pages 專案頁 | `/website/` | 預設（production） |
| 使用者／組織根頁 | `/` | `VITE_BASE=/ npm run build` |
| 自訂網域 | `/` | 同上 |
| 子目錄部署 | `/子目錄/` | `VITE_BASE=/子目錄/ npm run build` |

目前 `og:image` 為像素renderer截圖的絕對URL（`https://fknejdcwnfi.github.io/website/og-pixel.png`），舊`og-image.webp`保留，
確保社交平台能正確預覽。若改用自訂網域或搬到其他平台，請同步更新 `index.html` 的 `og:url` 與 `og:image`。

### 6.3 快取

Vite 會為 JS／CSS 產生帶 hash 的檔名，可長期快取。
`public/assets/frames/*.webp` 沒有 hash，更新圖片後若 CDN／瀏覽器快取未失效，請重新命名檔案或調整快取標頭。
GitHub Pages 的快取時間較短，通常不需要手動處理。

### 6.4 替代平台

| 平台 | 設定 |
| --- | --- |
| Cloudflare Pages | Build command `npm run build`；Output `dist`；`VITE_BASE=/` |
| Vercel | Framework preset Vite；Output `dist`；`VITE_BASE=/` |
| Netlify | Build `npm run build`；Publish `dist`；`VITE_BASE=/` |

---

## 7. 樣式與設計約定

- 設計是**深色單一舞台**：背景近黑藍，角色是唯一亮點。
- 舞台寬度：`min(92vmin, 860px)`；手機為 `min(94vmin, 860px)`。
- 圓角、陰影、光暈都集中在 `.stage` 與 `.aura`，不要分散到元件。
- 不要加入可見文字、按鈕、導航或 footer。
- 顏色以 CSS 變數定義在 `:root`；新增顏色先加變數。
- 動畫尊重 `prefers-reduced-motion`；新增 CSS 動畫時要一併處理。
- 不使用外部字型或 CDN，避免額外請求與授權問題。

---

## 8. 程式碼約定

- TypeScript `strict`，不使用 `any`；必要時用 `unknown` + 型別收窄。
- 註解與識別字用英文；使用者可見文件用繁體中文。
- 每個動畫模組只負責一件事；不要讓元件直接操作 canvas。
- 新增 URL 參數時，同步更新 [03 規格 §9](03-animation-spec.md#9-除錯與量測) 與本文件。
- 時間相關計算一律用毫秒與 `performance.now()`；不要用 `Date.now()`。
- 迴圈中的 delta 要 clamp，避免分頁恢復時大跳。
- 清理資源：`cancelAnimationFrame`、`disconnect`、`removeEventListener` 必須成對。
- 不要引入新依賴而沒有在 PR 說明理由與體積影響。

---

## 9. Git 與提交

- 分支：`main` 是原始碼與可部署內容的來源；推送 `main` 會觸發 GitHub Actions 部署。`gh-pages` 是備援用的生成分支，不要直接編輯。
- 提交訊息建議 Conventional Commits：
  - `feat: add layered hair rig`
  - `fix: keep loop seamless after tab restore`
  - `docs: document wind parameters`
- 每個 PR 只做一件事；視覺變更附 before／after 截圖或錄影。
- 不要提交 `node_modules/`、`dist/`、`*.tsbuildinfo`、暫存截圖。
- 不要修改 `assets/source/**`；需要新素材時依 [02 清冊 §8](02-asset-inventory.md#8-若要新增素材) 登記。

---

## 10. 疑難排解

| 症狀 | 原因 | 解法 |
| --- | --- | --- |
| `npm run dev` 開啟是空白 | 看 console；可能是 JS 錯誤或 #root 缺失 | 確認 `index.html` 有 `<div id="root">` |
| 圖片 404 | base path 不一致 | dev 用 `/`；preview 用 `/website/` |
| 部署後樣式或圖片 404 | Pages base 未設為 `/website/` | 檢查 `vite.config.ts` 與 `VITE_BASE` |
| `npm ci` 失敗 | Node 版本過舊或 lockfile 不一致 | 使用 Node 24；先確認lockfile一致，再以 `npm ci` 安裝 |
| `tsc` 抱怨 `import.meta.env` | 缺少 `vite/client` 型別 | 確認 `tsconfig.json` 的 `types` |
| 素材腳本失敗 | 缺少 Pillow 或張數不是 10 | 安裝 Pillow；確認 `assets/source/frames/` |
| 動畫在背景分頁停止 | 這是設計 | `visibilitychange` 會暫停，回來續播 |
| 手機上舞台超出畫面 | 瀏覽器網址列／安全區 | 已使用 `dvh` 與 safe-area；確認沒有自訂 CSS 覆蓋 |
| HUD 數值不更新 | 截圖或 headless 環境時間未前進 | 在真實瀏覽器開啟；或使用 `?pose=` 凍結 |
| Pages 部署失敗 | Actions 失敗、Pages 未設為 GitHub Actions，或權限不足 | 看 Actions log；Settings → Pages → Source: GitHub Actions；必要時用 `npm run deploy` 備援 |
| 推送 workflow 被拒 | 憑證缺少 `workflow` scope | 換成有 `repo` + `workflow` 的 PAT，或使用有 Workflows 權限的 GitHub App |

---

## 11. 延伸閱讀

- [03 動畫規格](03-animation-spec.md)：時間軸與驗收
- [04 架構](04-architecture.md)：Stage 2–4 的設計
- [06 Codex 交接](06-codex-handoff.md)：代理工作流程
- [07 QA 檢查表](07-qa-checklist.md)：送出前檢查
- [08 決策紀錄](08-decisions.md)：技術選擇的理由