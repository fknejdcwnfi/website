# 06 · Codex Cloud 交接

> **目前交接入口（2026-10-28）**：先讀本次像素舞台契約，再開發、驗證、自動合併並確認 Pages 部署。使用既有雲端 checkout，不建立 worktree。下列 P0–P7 與提示詞為舊 anime rig 路線歷史；其中禁止像素／Minecraft、需要重新取得像素風授權及先做 P2 的限制不適用新要求。來源唯讀、檢查、誠實驗收與自動合併規則仍適用。 目前有效規格見 [10 像素舞台](10-pixel-stage.md) 與 [ADR-014](08-decisions.md#adr-014--預設切換為-minecraft-風格像素動態-vermouth)。

- **狀態**：Stage 1 已就緒，等待 Stage 2 以上的工作
- **最後更新**：2026-10-28
- **適用對象**：Codex Cloud、其他自動化代理、接手的人類開發者

這份文件是代理的**操作手冊**，不是產品規格。
產品要做什麼，看 [03 動畫規格](03-animation-spec.md)；技術怎麼做，看 [04 架構](04-architecture.md)。

---

## 0. 先讀這些（按順序）

0. 根目錄 [`AGENTS.md`](../AGENTS.md) — Codex 連接時自動載入的速查規則
1. 本文件
2. [01 專案章程](01-project-charter.md) — 範圍與非目標
3. [02 素材清冊](02-asset-inventory.md) — 哪些素材不可動
4. [03 動畫規格](03-animation-spec.md) — 驗收標準
5. [04 架構](04-architecture.md) — 目標技術路線
6. [05 開發指南](05-development.md) — 指令與部署

若時間有限，至少讀完本文件的 §2（硬性規則）與 §4（工作順序）。

---

## 1. 你接手的是什麼

**已完成**：

- 可執行的 Vite 8 + React 19 + TypeScript 7 專案。
- 十張關鍵姿態的時間軸（2300 ms 循環）。
- Canvas 2D 的交叉淡入播放器。
- 深色單舞台的視覺設計、響應式、減少動態支援。
- WebP 素材管線與 manifest。
- GitHub Pages 部署（`main` 由 GitHub Actions 自動建置；`gh-pages` 為手動備援）。
- 完整文件與 QA 清單。

**未完成（你的工作）**：

- 把十張不一致的 AI 幀，轉成分層、可綁定的角色。
- 頭髮的七組獨立變形與風力模型。
- 眼皮圖層與 220 ms 的自然眨眼。
- 耳環的鐘擺、乾淨底圖與補繪。
- 視覺回歸測試與效能調校。

**不要做的事**：把 Stage 1 的交叉淡入說成完成品。
它是預覽，文件已明確標示；對外說明必須一致。

---

## 2. 硬性規則（MUST / MUST NOT）

### 2.1 素材

- **MUST** 把 `assets/source/**` 視為唯讀。不得覆寫、裁切、重新編碼或刪除。
- **MUST** 把任何生成物放到 `assets/generated/<stage-or-date>/` 或 `public/assets/rig/`。
- **MUST** 在第 1 幀與第 10 幀之間保持位元組相同（或明確提出變更並更新文件）。
- **MUST NOT** 用 AI 重新生成臉部來「修復」不一致；臉部唯一權威是 `frame_01.png`。
- **MUST NOT** 把原始 PNG 直接放進 `public/`；一律經管線產生 WebP。

### 2.2 視覺

- **MUST** 保留原動漫畫風、線條、配色、構圖與角色身份。
- **MUST** 保持 1:1 正方形舞臺與固定鏡頭。
- **MUST NOT** 改成 pixel art、Minecraft、3D、寫實風或重新設計角色。
- **MUST NOT** 加入可見 UI（導航、按鈕、文字、社群圖示）。
- **MUST NOT** 用整張圖的平移、旋轉或縮放假裝頭髮或眨眼。

### 2.3 工程

- **MUST** 保持 `npm run build` 與 `npm run typecheck` 通過。
- **MUST** 保持 GitHub Pages 的 base path 可運作（預設 `/website/`）。
- **MUST** 保持 `.github/workflows/deploy.yml` 可執行；不要停用或破壞自動部署。
- **MUST** 尊重 `prefers-reduced-motion`。
- **MUST** 在變更行為時同步更新 `docs/` 與 `CHANGELOG.md`。
- **MUST NOT** 引入新依賴而沒有在 PR 說明理由、體積與替代方案。
- **MUST NOT** 提交 `node_modules/`、`dist/`、暫存檔或金鑰。

### 2.4 誠實交付

- **MUST** 區分「已實作」、「暫定」、「未完成」。
- **MUST** 在無法完成視覺驗收時，明確列出限制，不得聲稱已完成。
- **MUST NOT** 用模糊、對齊或濾鏡掩蓋素材瑕疵；這在動態中會暴露。

---

## 3. 環境與指令

```bash
npm ci
npm run dev          # 開發
npm run build        # 型別 +  bundle
npm run typecheck
npm run assets:check
npm run assets:verify
```

部署：推送或合併到 `main` 會由 GitHub Actions 自動建置與發佈，不需要執行部署指令。
`npm run deploy` 是 `gh-pages` 手動備援，需經擁有者同意。

視覺檢查：

```bash
npm run preview
# http://localhost:4173/website/
# http://localhost:4173/website/?debug=1
# http://localhost:4173/website/?pose=5
```

若環境有 Chromium／Playwright，可截圖比對：

```bash
# 範例；實際路徑依環境而定
chrome --headless=new --disable-gpu --hide-scrollbars \
  --force-prefers-reduced-motion --window-size=1200,1000 \
  --screenshot=artifacts/stage.png \
  http://127.0.0.1:4173/website/?pose=1
```

沒有瀏覽器時：

- 至少執行 `npm run build`、`npm run typecheck`。
- 用 `?pose=` 的程式邏輯與單元測試驗證時間軸。
- 在 PR 明確寫出「未進行瀏覽器視覺驗收」。

---

## 4. 工作順序

> 一次只做一個階段。不要在同一 PR 同時改素材、rig、樣式與部署。

### P0 · 基線確認（必做，約 15 分鐘）

- `npm ci && npm run build`。
- 啟動 preview，確認首頁、`?debug=1`、`?pose=5` 正常。
- 確認 `frame_01` 與 `frame_10` 的 SHA-256 相同。
- 確認最近一次 GitHub Actions `Deploy to GitHub Pages` 為綠色。
- 產出基線截圖，存入 `artifacts/baseline/`（不提交，或依 PR 需要提交小圖）。

**完成條件**：能在 PR 描述中貼出基線截圖與指令輸出。

### P1 · 分層規劃（不寫渲染程式）

- 依 [04 架構 §2.4](04-architecture.md#24-圖層與-draw-order) 建立圖層清單。
- 為每個圖層標記：來源幀、是否需要補繪、預估遮罩難度。
- 產出 `docs/09-layer-plan.md`（新文件），包含圖層表與風險。
- 不要在這一步產生最終素材。

**完成條件**：擁有者可以只讀文件就理解「哪些區域需要補繪、為什麼」。

### P2 · 素材生產（最耗時）

- 以第 1 幀為底圖，切出 `face_base`、`eye_sockets`、`iris_L/R`、`body`、`necklace`。
- 以第 4／5 幀為參考，建立 `eyelids`。
- 建立七組髮絲的 alpha matte；必要時使用分割工具。
- 補繪被遮擋的區域（clean plate）。
- 所有輸出放 `assets/generated/v1/`，並在 `docs/02-asset-inventory.md` 登記。
- 若補繪品質不足，停止並回報；不要用模糊或拉伸掩蓋。

**完成條件**：圖層在 1080² 座標系中對齊；疊合後與第 1 幀的差異僅限於允許的區域。

### P3 · 靜態合成

- 用 PixiJS（或經 ADR 批准的方案）把圖層按 draw order 疊起來。
- 先不做變形；目標是「靜態畫面與第 1 幀一致」。
- 保留 `?layers=1` 除錯模式（顯示圖層邊界）。
- 替換 Canvas 2D player，但保留 Stage 1 作為 `legacy/` 或 feature flag。

**完成條件**：靜態截圖與第 1 幀的像素差異在容許範圍內；build 通過。

### P4 · 頭髮風力

- 為七組髮束建立網格與權重。
- 實作風力包絡、相位、彈簧阻尼。
- 用 `?wind=`、`?speed=`、`?seed=` 除錯（新增參數需更新文件）。
- 先小幅位移，確認無破洞與穿模，再逐步放大。

**完成條件**：A8（髮根固定）、A10（無穿模）通過；視覺上無果凍或鋼絲感。

### P5 · 眨眼

- 實作眼皮圖層與四段姿態。
- 對齊 630／740／850 ms；全程 220 ms。
- 檢查虹膜、睫毛、眉毛、鼻樑。
- 加入 `?blink=1` 強制眨眼（除錯用）。

**完成條件**：A7（眨眼時長與穩定性）通過；無頭部縮放。

### P6 · 飾物與收尾

- 耳環鐘擺、項鏈微動。
- 調整風力峰值、阻尼、相位。
- 檢查循環點、第 10 幀與第 1 幀一致性。
- 效能調校：atlas、解碼、draw call、DPR。

**完成條件**：A1–A15 全數通過或明確標示例外。

### P7 · 文件與發佈

- 更新 `README.md`、`CHANGELOG.md`、`docs/03`、`docs/04`、`docs/07`。
- 產出 before／after 截圖與短錄影（可放 `docs/assets/`，單檔 < 2 MB）。
- 若變更架構，補 ADR。
- 開 PR；必要 CI 與本次變更相關驗證通過、無阻擋審查／衝突／未解回歸後自動合併，並確認 Pages 部署結果。
- 合併到 `main` 後確認 GitHub Actions 部署成功；代理不要自行執行 `npm run deploy` 備援。

**完成條件**：文件與程式碼一致；PR 描述包含驗收證據。

---

## 5. 檔案所有權

| 路徑 | 代理可以… | 備註 |
| --- | --- | --- |
| `assets/source/**` | 只讀 | 禁止任何寫入 |
| `assets/generated/**` | 建立、修改 | 需登記來源與工具 |
| `public/assets/rig/**` | 建立、修改 | 需同步 manifest／清冊 |
| `public/assets/frames/**` | 只由腳本產生 | 不手動編輯 |
| `scripts/verify_assets.py` | 修改 | 保持 CI 可執行（stdlib only） |
| `src/animation/keyPoses.ts` | 修改 | 先更新 03 規格 |
| `src/animation/player.ts` | 替換或保留 | 需保留 reduced motion 行為 |
| `src/components/CharacterStage.tsx` | 修改 | 不得加入可見 UI |
| `src/styles.css` | 修改 | 維持深色單舞台 |
| `docs/**` | 修改 | `docs/reference/**` 凍結 |
| `.github/workflows/**` | 修改 | 保持 `deploy.yml` 綠色；需要 `workflow` 權限 |
| `scripts/deploy_gh_pages.sh` | 修改 | 手動備援；部署需經擁有者同意 |
| `package.json` | 修改 | 新依賴需說明 |

---

## 6. 驗證協定

每次 PR 至少提供：

1. **指令輸出**：`npm ci`、`npm run build`、`npm run typecheck`、`npm run assets:check`、`npm run assets:verify`。
2. **靜態截圖**：`?pose=1`、`?pose=5`、`?pose=7`（1200×1000，DPR 1）。
3. **動態證據**：10 秒錄影或 GIF，涵蓋完整循環與眨眼。
4. **效能數據**：DevTools Performance 或 Lighthouse 摘要。
5. **CI 狀態**：PR 的 `CI` workflow 與合併後 `Deploy to GitHub Pages` 是否成功。
6. **已知限制**：明確列出未完成、未驗證、需要人類判斷的項目。

若環境沒有瀏覽器，第 2–4 項可標為「未執行」，但**不得省略說明**。

### 視覺比對建議

```text
1. 以 ?pose=1 截圖作為 baseline。
2. 以 ?pose=N 截圖，與 baseline 做差分。
3. 臉部區域只允許頭髮遮擋與眼皮變化；幾何位移應 < 2 px。
4. 以 ?debug=1 記錄 t、wind、eyeOpen，確認與規格一致。
```

---

## 7. PR 與提交

擁有者於 2026-10-28 授權目前與後續任務採用「驗證通過後自動合併」，不再逐次詢問。此授權取代舊任務中的單純禁止自行合併限制；不代表可跳過必要檢查、繞過分支保護、自動進入下一階段，或自行接受素材／架構待決事項。較新的明確任務指示優先。

- 一個 PR 一個關注點。
- 標題用 Conventional Commits：`feat: add eyelid layer`, `fix: keep hair roots fixed`。
- 描述包含：
  - 動機與範圍
  - 變更摘要
  - 驗收證據
  - 已知限制
  - 文件更新清單
- 不要 force push 到 `main`；不要直接修改已部署的產物。
- 若本機檢查或建置失敗，先修正，不要合併。

---

## 8. 可直接貼上的啟動提示詞

把下面整段貼給 Codex Cloud（連接此倉庫後）：

```text
You are continuing the "Vermouth Character Stage" project.

Read these files first, in order:
0. AGENTS.md
1. docs/06-codex-handoff.md
2. docs/01-project-charter.md
3. docs/02-asset-inventory.md
4. docs/03-animation-spec.md
5. docs/04-architecture.md
6. docs/05-development.md

Current state: Stage 1 (key-pose cross-fade preview) is deployed. It is provisional,
not the final seamless animation. Pushes/merges to main deploy automatically via
.github/workflows/deploy.yml; gh-pages + `npm run deploy` is a manual fallback only.

Your task for this session: <choose ONE stage from §4 of the handoff doc>,
for example "P1: produce docs/09-layer-plan.md".

Hard rules:
- assets/source/** is read-only. Never overwrite or regenerate the source frames.
- Do not replace frame_01 as the identity authority.
- Do not add visible UI, text, navigation, or interaction.
- Do not use pixel art, 3D, or a whole-image translate/scale to fake motion.
- Do not present the cross-fade as a finished seamless animation.
- Keep `.github/workflows/deploy.yml` and `ci.yml` working; do not disable auto-deploy.
- Do not run `npm run deploy` unless the owner explicitly asks for the fallback.
- Keep `npm run build` and `npm run typecheck` green.
- Update docs and CHANGELOG for any behavior change.

Before coding: restate the acceptance criteria for the chosen stage.
After coding: run the commands in §6, attach screenshots or explain why visual
verification was not possible, and list remaining limitations.
Open a PR. Once required CI and change-relevant validation pass and no merge
blockers remain, merge it automatically and verify the Pages deployment.
```

---

## 9. 停手條件（Stop Conditions）

遇到以下情況，**停止並回報**，不要硬做：

- 缺少可用的分割／inpainting 工具，導致無法產生 clean plate。
- 補繪後仍露出明顯破洞或雙線。
- 需要重新生成角色臉部才能繼續。
- 需要改變角色設計、畫風或構圖。
- 需要加入後端或非靜態服務。
- 不確定是否會覆蓋原始素材。
- 視覺驗收無法進行，且變更風險高。

回報格式：

```text
STOPPED: <一句話原因>
已完成：<列出>
未完成：<列出>
需要人類決定：<具體問題，附選項>
```

---

## 10. 開放問題（先問，不要自行決定）

1. 是否使用 PixiJS？還是優先 Live2D／Rive？
2. 是否允許外部 AI 分割／補繪？生成物如何標註？
3. 是否接受為了補繪而局部重畫？範圍到哪裡？
4. 是否加入自訂網域？
5. 目標最低裝置效能？
6. 是否要加入極簡身份文字？（目前規格是不要）

---

## 11. 交接紀錄

| 日期 | 版本 | 經手 | 內容 | 備註 |
| --- | --- | --- | --- | --- |
| 2026-10-28 | 0.1.0 | 初始建置 | 重構素材、建立 Stage 1、文件、CI／Pages | 等待 Stage 2 |

新增紀錄時，保留舊列，不要覆寫。
