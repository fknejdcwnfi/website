# 08 · 決策紀錄（ADR）

本文件記錄已經做出的技術與產品決策，以及理由與後果。
新決策請**追加**，不要改寫舊決策；若推翻舊決策，新增一則並標記「取代 ADR-XXX」。

格式：`狀態｜日期｜決策者`，狀態為 `已接受`、`提議`、`已取代`、`已棄用`。

---

## ADR-001 · 使用 Vite + React + TypeScript

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：專案擁有者、初始建置

**背景**
原始任務書明確要求 React + Vite + TypeScript，且網站是純靜態、無後端。
需要一個能快速啟動、容易部署到 GitHub Pages、且代理能理解的標準棧。

**決策**
使用 Vite 8、React 19、TypeScript 7，以 npm 管理依賴。
不使用 Next.js、Astro、Svelte 或純 HTML。

**理由**

- Vite 的建置速度快，設定簡單，`base` 可直接支援 GitHub Pages 子路徑。
- React 足以處理單一舞台的生命週期與除錯 UI；不需要伺服器端渲染。
- TypeScript 的嚴格模式能在代理協作時捕捉大部分介面錯誤。
- 三者都是主流，Codex Cloud 對其生態熟悉。

**後果**

- 需要 Node 22.12+。
- JS 打包約 225 KB（gzip 71 KB）；對單頁網站可接受。
- 若未來需要多頁內容，可能需要額外路由或遷移到 Astro；目前不在範圍。

---

## ADR-002 · Stage 1 使用 Canvas 2D 渲染

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：初始建置

**背景**
需要播放十張關鍵姿態，並為未來的網格變形保留空間。
可選方案：多個 `<img>` + CSS opacity、Canvas 2D、WebGL/PixiJS。

**決策**
Stage 1 使用 Canvas 2D，由 `KeyPosePlayer` 管理預載、取樣、交叉淡入與尺寸。

**理由**

- 比十個 `<img>` 更容易控制 draw order 與除錯繪製。
- 比 WebGL 輕，Stage 1 不需要 mesh 或 shader。
- 責任邊界與未來的 renderer 相似，替換成本低。
- 可直接處理 DPR 與 backing store 尺寸。

**後果**

- 需自行處理 ResizeObserver、rAF、生命週期與資源清理。
- Stage 3 仍會替換為 WebGL/PixiJS；Canvas 2D 不是最終方案。
- 若瀏覽器不支援 2D context，播放器會拋出錯誤；目前沒有 fallback（可接受，因為所有目標瀏覽器都支援）。

---

## ADR-003 · 交叉淡入是暫定方案，不得對外稱為完成品

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：專案擁有者（依原始任務書）

**背景**
十張關鍵姿態由獨立 AI 生成，臉部與髮絲不完全一致。
把它們直接輪播或交叉淡入，會產生殘影與身份漂移。
原始任務書明確禁止「把十張不一致的圖直接輪播並冒充無縫動畫」。

**決策**
Stage 1 可以使用**短暫**交叉淡入作為預覽，但必須：

- 在 README、章程、規格與對外說明中標示為 provisional。
- 時間軸與舞台視覺可保留；渲染核心將在 Stage 3 替換。
- 不得以「已完成」、「無縫」描述 Stage 1。

**理由**

- 先部署一個可看的版本，能驗證舞臺、時間軸、部署與視覺方向。
- 完全不做預覽會讓專案停在素材階段，無法驗證基礎設施。
- 誠實標示可避免誤導擁有者與後續代理。

**後果**

- 訪客可能看到輕微殘影；這是已知限制。
- Stage 2–3 的驗收必須以「無殘影」為門檻，不能沿用 Stage 1 的標準。
- 文件與 PR 必須持續維持這個區分。

---

## ADR-004 · 原始 PNG 不可變，網站只載入 WebP 衍生檔

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：初始建置

**背景**
原始素材約 16.9 MB，直接服務會拖慢首屏；但原始素材是身份與構圖的唯一依據，不能破壞。

**決策**
`assets/source/**` 唯讀；由 `scripts/optimize_assets.py` 產生 1080²、quality 86 的 WebP 到 `public/assets/frames/`，並輸出 manifest。

**理由**

- 十幀由 16.9 MB 降至約 1.4 MB。
- 管線可重現，衍生檔可刪除重建。
- manifest 提供尺寸、位元組數與 SHA-256，便於檢查同步。
- 原始素材保留，未來 Stage 2 仍可使用最高品質來源。

**後果**

- 修改原始素材後必須重跑 `npm run assets`。
- 新增素材需登記，否則管線不會自動納入（目前固定十張）。
- WebP 不支援的極舊瀏覽器會看不到圖；目標瀏覽器皆支援。

---

## ADR-005 · 部署到 GitHub Pages，production base 為 `/website/`

- **狀態**：已接受（部署機制經 ADR-011、ADR-012 演進）
- **日期**：2026-10-28
- **決策者**：專案擁有者

> 本 ADR 保留當時的決策紀錄。目前由 GitHub Actions 自動部署，`gh-pages` 僅為手動備援；見 [ADR-012](#adr-012-在取得-workflow-權限後切回-github-actions-自動部署)。

**背景**
擁有者要求先部署到 GitHub，後續用 Codex Cloud 連接編輯。
倉庫名稱是 `website`，GitHub Pages 專案頁會位於 `/website/`。

**決策**
使用 GitHub Actions 建置並發佈 `dist/`；`vite.config.ts` 在 production 時設定 `base: '/website/'`，可用 `VITE_BASE` 覆寫。

**理由**

- 不需要額外帳號或服務。
- 推送 `main` 即自動部署，符合「先部署再編輯」的流程。
- `VITE_BASE` 保留搬遷到自訂網域或其他平台的彈性。

**後果**

- 首次需在 Settings → Pages 將 Source 設為 GitHub Actions。
- 若改用自訂網域，需設定 `VITE_BASE=/` 並更新 `og:image` 為絕對 URL。
- GitHub Pages 對靜態資源的快取時間較短，更新圖片通常不需手動清快取。

---

## ADR-006 · 舞臺不加入可見 UI

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：專案擁有者（依原始任務書）

**背景**
原始任務書要求「畫面中只有角色，網站沒有其他功能」。
但個人網站通常需要身份、導航或聯絡方式。

**決策**
目前版本不加入任何可見文字、導航、按鈕、footer 或社群圖示。
除錯資訊只透過 URL 參數顯示。

**理由**

- 尊重原始委託的視覺意圖：角色是唯一主體。
- 減少視覺干擾，讓舞台像一件作品而不是產品頁。
- 除錯需求可用 URL 參數滿足，不需要常駐 UI。

**後果**

- 訪客無法從頁面得知這是誰的網站；身份資訊目前只存在於 repo 與 meta。
- 若未來要加入身份文字，需開新 ADR 並更新章程的非目標。
- 無互動元素，因此鍵盤可及性風險低。

---

## ADR-007 · 除錯開關使用 URL 查詢參數

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：初始建置

**背景**
需要在不加入可見 UI 的前提下，檢查時間、姿態、風力與凍結畫面。

**決策**
使用 `?debug=1`、`?pose=1..10`；未來可擴充 `?wind=`、`?speed=`、`?layers=`、`?seed=`。

**理由**

- 不影響一般訪客。
- 容易在截圖、錄影與自動化測試中重現。
- 不需要建立額外的 dev panel 或路由。

**後果**

- 參數必須文件化，否則代理與後續開發者不會知道。
- 一般訪客可能誤觸；參數無害，且不會破壞播放。
- 若參數過多，未來可能需要一個 dev-only 面板；目前不需要。

---

## ADR-008 · 目前不引入測試框架

- **狀態**：已接受（暫定）
- **日期**：2026-10-28
- **決策者**：初始建置

**背景**
Stage 1 的邏輯很少，主要是時間軸取樣與 Canvas 繪製。
引入 Vitest + Playwright 會增加依賴與維護成本。

**決策**
目前只使用 `tsc --noEmit` 與 `vite build` 作為自動化門檻；視覺與動態以人工檢查為主。
Stage 3 之前應補上單元與視覺回歸測試。

**理由**

- 先建立可部署的基線，避免過度工程。
- Stage 1 的渲染很快會被替換，為它寫大量測試的回報低。
- 文件已提供 QA 清單，能覆蓋現階段風險。

**後果**

- 時間軸或渲染的回歸可能不會被 CI 捕捉。
- 代理變更時需更依賴人工截圖與 PR 審查。
- 這是一個**有時限的例外**，不是長期政策。

---

## ADR-009 · Stage 3 提議使用 PixiJS v8 + Mesh + Shader

- **狀態**：提議（尚未接受）
- **日期**：2026-10-28
- **決策者**：待擁有者確認

**背景**
Stage 3 需要分層、網格變形、風力 shader 與高效能合成。
可選：Canvas 2D 手寫網格、PixiJS、自寫 WebGL、Live2D、Spine、Rive。

**提議**
使用 PixiJS v8，以程式碼建立 mesh 與權重，風力以 shader 或預計算頂點位移實作。

**理由**

- 素材是點陣圖，沒有現成 Live2D 模型。
- PixiJS 的 mesh 與 container 模型適合分層角色。
- 可在程式碼中版本控制 rig，不需要美術編輯器。
- 社群大、文件完整，代理較容易正確使用。

**缺點**

- 增加約 100 KB 依賴。
- 需要處理 WebGL context 遺失與低階裝置 fallback。
- 仍不如 Live2D 的臉部變形自然。

**待決**

- 擁有者是否接受新增依賴？
- 是否有辦法取得 Live2D 模型？若有，應優先評估。
- 低階裝置是否需要 Canvas 2D fallback？

在決定前，不要開始 Stage 3 的渲染實作。

---

## ADR-010 · 文件以繁體中文撰寫，程式碼註解使用英文

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：專案擁有者（語言偏好）

**背景**
專案擁有者以中文溝通；原始素材文件為繁體中文。
程式碼需要與主流生態一致，且代理以英文訓練更穩定。

**決策**
使用者可見文件、README、PR 說明使用繁體中文；程式碼識別字與註解使用英文。
素材中的英文 prompt 保留原樣。

**理由**

- 文件給人讀，使用擁有者熟悉的語言。
- 程式碼給工具與跨語言開發者讀，英文較通用。
- 避免在同一檔案中混用多種語言造成混亂。

**後果**

- 代理回報時應使用繁體中文，但程式碼維持英文。
- 若未來需要英文文件，應新增 `docs/en/`，而不是改寫現有文件。

---

## ADR-011 · GitHub Pages 改用 `gh-pages` 分支部署

- **狀態**：已取代（由 ADR-012）
- **日期**：2026-10-28
- **決策者**：專案擁有者
- **取代**：ADR-005 的「GitHub Actions」部署機制

> 這是暫時性決策。擁有者後來提供具備 `workflow` scope 的憑證，已切回 GitHub Actions；
> 見 [ADR-012](#adr-012-在取得-workflow-權限後切回-github-actions-自動部署)。以下保留當時紀錄。

**背景**
ADR-005 原本規劃使用 GitHub Actions 自動部署。實際推送時，GitHub 拒絕了
`.github/workflows/**`，因為目前使用的 Personal Access Token 具備 `repo` scope，
但沒有 `workflow` scope：

```text
refusing to allow a Personal Access Token to create or update workflow
`.github/workflows/deploy.yml` without `workflow` scope
```

擁有者選擇不改動 token 權限，改用分支部署。

**決策**
使用 `scripts/deploy_gh_pages.sh`（`npm run deploy`）：

1. `npm run build`。
2. 將 `dist/` 複製到暫存目錄，加入 `.nojekyll`。
3. 建立 `gh-pages` 分支並提交。
4. 強制推送到 `origin/gh-pages`。

GitHub Pages 設定為 **Deploy from a branch → `gh-pages` / root**。

預備的 Actions workflow 移到 `deploy/github-actions/`，不置於 `.github/workflows/`，
因此不會觸發 `workflow` scope 限制，也不會自動執行。
未來若 token 加上 `workflow` scope，可依該目錄的 README 啟用。

**理由**

- 不需要擴大 token 權限。
- `gh-pages` 分支部署是 GitHub Pages 的標準機制，穩定且可預測。
- 保留 Actions workflow 作為未來選項，不丟失既有工作。
- 建置仍在本機／CI 之外進行，容易除錯。

**後果**

- 每次更新後必須手動執行 `npm run deploy`；不會因 push `main` 自動上線。
- `gh-pages` 是生成分支，禁止直接編輯；`npm run deploy` 會 force push。
- 目前沒有遠端 CI；PR 檢查以本機指令與人工審查為主。
- 若同時啟用 Actions，必須把 Pages Source 改為 GitHub Actions，避免兩種機制互相覆蓋。
- `base` 仍為 `/website/`，ADR-005 的這部分不變。

---

## ADR-012 · 在取得 `workflow` 權限後切回 GitHub Actions 自動部署

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：專案擁有者
- **取代**：ADR-011

**背景**
ADR-011 因本地憑證缺少 `workflow` scope，改用 `gh-pages` 分支部署。
擁有者隨後更新了 GitHub 憑證，使其可以建立／更新 `.github/workflows/**`，
並要求恢復「推送 `main` 即自動建置」的流程。

**決策**

1. 將 `deploy/github-actions/deploy.yml` 與 `ci.yml` 移回 `.github/workflows/`。
2. `deploy.yml` 在 `actions/configure-pages@v5` 設定 `enablement: true`。
   注意：若 Pages 已經以 legacy branch 啟用，`enablement` 不會自動切換；
   需另外將 Pages Source 設為 GitHub Actions（本次以
   `PUT /repos/{owner}/{repo}/pages` 帶 `{"build_type":"workflow"}` 完成）。
3. GitHub Pages Source 設為 **GitHub Actions**。
4. 保留 `scripts/deploy_gh_pages.sh`（`npm run deploy`）作為手動備援。
5. README、docs/01、docs/04、docs/05、docs/06、docs/07、AGENTS.md、CHANGELOG 同步更新。

**理由**

- 推送 `main` 即部署，符合「先部署再編輯」的長期流程。
- PR 由 `ci.yml` 檢查，main 由 `deploy.yml` 發佈，責任清楚。
- `gh-pages` 備援在 Actions 故障時仍可用，不增加日常成本。
- 具備 `workflow` 權限後，GitHub 不再拒絕 workflow 檔案。

**後果**

- 推送 `main` 會自動觸發部署；不需要手動 `npm run deploy`。
- 修改 `.github/workflows/**` 仍需要具備 `workflow` scope 的憑證；若換回受限 token，推送會被拒。
- 不要同時使用 Actions 與 `gh-pages` 分支部署；若切到備援，必須同步改 Pages Source。
- PR 的 `CI` workflow 成為合併前的必要檢查。
- `gh-pages` 分支保留，但不再自動更新。

---

## ADR-013 · 抽出純時間軸模組，靜止時停止 rAF

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：專案維護者

**背景**
原本時間軸取樣邏輯嵌在 `KeyPosePlayer` 內，與 Canvas、DOM 和 Vite 的
`import.meta.env` 混在一起；`prefers-reduced-motion` 或 `?pose=N` 靜止時，
rAF 仍以 60 fps 重畫同一幀，浪費 CPU 與電量。

**決策**

1. 將取樣與交叉淡入計算移到 `src/animation/timeline.ts` 的純函式
   `sampleTimeline(poses, timeMs, loopMs)`，不依賴 DOM／Vite。
2. `KeyPosePlayer` 只負責載入、繪製、尺寸與生命週期。
3. 新增 `isStatic()`：reduced motion 或 frozen pose 時只畫一次並 `stop()`；
   解除靜止後再 `start()`，保留 `elapsedOffset` 相位。
4. 新增 `scripts/verify_assets.py`（stdlib only）作為 CI 的素材完整性閘門。

**理由**

- 純函式可在未來用 Node／Vitest 測試，不需要瀏覽器或 Canvas。
- 靜止畫面不再消耗 rAF，符合 reduced-motion 的節能意圖。
- 素材雜湊與循環幀一致性由 CI 自動檢查，降低雲端協作的回歸風險。

**後果**

- `player.ts` 變得更薄；Stage 3 替換渲染器時，時間軸可沿用。
- `assets:verify` 成為 CI 與部署 workflow 的固定步驟；若 manifest 過期會直接失敗。
- 沒有新增 runtime 依賴。

---

## ADR-014 · 預設切換為 Minecraft 風格像素動態 Vermouth

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：專案擁有者的明確新指示
- **取代範圍**：舊章程／交接文件中禁止 pixel art、Minecraft、方塊造型及必須先走 anime 圖層 P1–P7 的限制；不刪改歷史 ADR。

**背景**

擁有者在完成原 P1 計畫後，明確要求繼續優化為「我的世界的像素動態 Vermouth」，並授權自動審查、推進、更新文件與網站。這是視覺方向變更，不應繼續以舊版禁止像素風的條款阻擋實作，也不能把新作品冒充已完成的原圖分層 rig。

**決策**

預設改為 Native Canvas 2D 的程序化像素／voxel 風格：192² 邏輯畫布、nearest-neighbor 放大、4800 ms 循環、24 fps 繪製上限；臉部固定，髮束、眼皮、耳環與背景像素光點各自繪製。眨眼窗口為220 ms。新 renderer 不新增第三方依賴，不載入十張舊圖作預設動畫。

原 anime 交叉淡入播放器保留在 `?style=legacy`，仍標為 provisional。來源原圖、GIF、contact sheet 與 `docs/reference/**` 保持唯讀；來源01／10位元組一致性與既有資產驗證保留。舊 ADR-009 的 PixiJS提案仍適用其歷史研究，並非本次新 renderer 的前置決策。

**個人化與品質**

以 URL保留 theme、wind、speed、seed、pose、debug等操作；網站外殼、metadata與將來個人內容可另行演進，不新增虛構個資或常駐 UI。新風格須保留白金髮、藍眼、深色服裝及藍飾物的角色辨識特徵，固定姿態、reduced motion與隱藏分頁停止無意義排程。不可把程序化風格重繪等同於原圖逐像素身份量測。

必要單元檢查、型別、建置、素材完整性與瀏覽器檢查通過後，依既有授權自動合併並確認 Pages 部署。主觀「完美」不是可驗證結論；缺少的裝置／視覺驗收與已知限制須如實回報。完整現行契約見 [10 像素舞台](10-pixel-stage.md)。

---

## ADR-015 · 以忠實 2D 像素立繪取代方頭 voxel 預設

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：擁有者最新詳細提示詞
- **取代範圍**：ADR-014對Minecraft風格採用方頭／方身voxel胸像、額外場景與4800 ms預設的解讀；歷史紀錄保留。

**背景**

擁有者明確要求Minecraft-inspired high-fidelity **2D pixel art portrait**：角色還原度優先，保留原始尖下巴、斜眼、神態、捲髮、首飾及近景肩線；排除Steve玩家造型、3D voxel、Q版大頭、單純馬賽克及十張AI圖獨立輪播。`original_reference.jpg`成為最高身份／構圖權威，其餘圖只提供動作意圖。

**決策**

以原始reference製作一份AI輔助canonical像素立繪，統一邏輯網格與受控調色盤。閉眼編輯材料僅取局部眼區；臉、眉、鼻、嘴、身體與項鏈不隨獨立生成圖替換。這是有來源限制的像素重繪，不等同原圖逐像素幾何重建。

預設`style=portrait`，以256²為起點比較192／320輸出；Native Canvas2D在同一網格渲染局部像素場。使用非矩形影響區及inverse mapping，避免髮片疊在未移除原髮上形成雙輪廓；未知臉側／肩頸沒有clean plate時限制動作，不以改臉解決。

恢復2300 ms參考風動循環，1890 ms回到初始像素並保持至循環點。眨眼630–850 ms共220 ms、740 ms全閉；630 ms連續動作起點與QA半閉姿態的差異明示。髮束延遲／剛度／阻尼、眼瞼與耳環分開，固定根點與像素網格。以60fps為目標，依production實測回報，不將舊版24fps或歷史數據冒充新版結果。

**範圍與證據**

正式網站只含正方形角色與深色背景；控制僅在debug模式顯示，不開發其他網站功能。舊`?style=voxel`與`?style=legacy`保留為比較。來源素材及凍結文件不動，新增AI母版／網站衍生檔的來源與雜湊另登記。

必須產生實際網站的十個參考時刻、原圖／靜止／風動／閉眼並排與動畫預覽，檢查身份、固定區、髮根、閉眼、飾物、遮擋、循環、DPI與生命週期。單元／build／CI通過不替代美術驗收；不聲稱主觀完美、所有裝置效能或未完成clean plate。驗證通過後沿用擁有者授權自動合併並確認Pages部署。完整契約見 [11 Living Portrait](11-living-portrait.md)。

---

## ADR-016 · 完整個人網站與肖像子系統分離

- **狀態**：已接受
- **日期**：2026-10-28
- **決策者**：擁有者最新明確澄清與個人化資料
- **取代範圍**：ADR-006及ADR-015中整站「只含角色、禁止導航／介紹／作品／聯絡」的範圍限制；不取代肖像美術與來源保護要求。

**背景**

擁有者明確表示要的是自己的簡潔標準個人網站，而不是只有一張圖；並指定稱呼fknejdcwnfi、招呼HELLOWORLD、Email fknejdcwnfi@gmail.com及Minecraft像素風格。Vermouth應成為首頁主視覺，個人內容與後續功能需有獨立演進空間。

**決策**

預設改為包含導覽、個人hero、關於、真實作品、Email／GitHub聯絡與頁尾的完整響應式網站。採簡潔像素視覺、自託管Press Start 2P及可讀中文，不新增遊戲HUD、假履歷、假作品、沒有後端的假送信表單或空功能卡片。作品使用真實公開repo與實際封存狀態。

個人資料與作品集中於 `src/content/site.ts`；`SiteShell`提供共享版面與內容插槽，`PersonalSections`渲染介紹／作品／聯絡。原2D肖像保留在hero，`?view=portrait`提供獨立檢視；角色rig、動畫與個人文案互不耦合。

由同一設定產生初始靜態HTML與metadata，JavaScript或互動程式不可用時仍有真實介紹、作品、聯絡與肖像。加入錯誤邊界、素材逾時及靜態降級，並檢查桌機、手機、鍵盤與故障情境。來源素材及凍結參考文件保持唯讀。

**交付與授權**

本輪使用者先前明確要求不要發佈，之後要求的是修改與可發佈的標準網站，尚未明確恢復發佈授權。因此完成本地修改、驗證與可檢閱結果，不能將它們回報為已上線，也不自動推送／合併／部署。歷史自動合併偏好仍保留，較新的任務特定指示優先。完整網站契約見 [12 個人網站](12-personal-site.md)。

---

## ADR-017 · 保留原近景去背與持續循環動態

- **狀態**：已接受
- **日期**：2026-10-29
- **決策者**：擁有者最新明確修正
- **取代範圍**：原肖像展示的可見方形背景／相框及公開播放控制；保留ADR-015的2D身份、原近景尺寸與動態，及ADR-016的完整個人網站與個人化結構。

**背景**

擁有者要前版原有大小、近景構圖與像素風格，只移除人物外部背景及邊框，使人物自然動起來，同時細化整站UI。向外補畫完整胸像的實驗已被明確拒絕，不能用「無邊框」解讀為改變人物比例或鏡頭。

**決策**

保留原有1:1近景邏輯畫布，預設256²、替代192²／320²；將v2母版作背景移除編輯，維持上緣髮絲與肩線裁切。編輯輸出保存在 `assets/generated/portrait-v4/`，runtime在 `public/assets/portrait-natural/`，使用42色調色盤與二值alpha。人物外與捲髮空隙透明；頁面不加角色相框、矩形底板、描邊卡片或方塊盒子，以柔和有機光暈融入整站。原始來源及凍結參考文件完全不動。

正常首頁沒有公開播放／暫停UI，2300 ms參考循環在人物可見時持續重播；1890–2300 ms是循環內靜止段，不是播放終止。局部髮動、眼瞼與耳環沿用，不能以整張圖平移／旋轉／縮放取代。減少動態、分頁隱藏及離屏仍停止繪製；返回保留原相位。明確debug／QA的pause、t、pose可固定狀態。

靜態備援為同一renderer的透明 `portrait-rest.png` 768²；首次真正繪製前保留poster，避免離屏載入後空白。OG另行合成分享背景。個人內容設定、`SiteShell`及未來真實功能擴充維持與角色rig獨立；不新增假內容或空功能。

**驗證與交付**

重新驗證透明邊緣、原尺度／裁切、固定人物區、局部動態、跨多輪連續播放、生命週期、無JS／故障備援及完整網站響應式導覽。新的實際網站證據在 `artifacts/natural-portrait/`及 `artifacts/personal-site/`；v2數字只作歷史，不冒充本輪數據。當時暫不發佈指示有效；此發佈限制現已由ADR-018的使用者最新授權解除。

---

## ADR-018 · 可見分層風動與恢復自動發佈

- **狀態**：已接受
- **日期**：2026-10-29
- **決策者**：擁有者最新明確要求

v4的多數髮束僅約1個邏輯像素位移，像素差分不足以證明參考風勢清楚可見。改為八個髮層、九段鏈取樣、修復底圖、較明顯的前景卷髮與兩條獨立耳環響應，保留同一v4近景身份、原2300 ms參考動作和局部眼瞼。臉與附著點固定，肩旁容許頭髮遮擋。以睜眼階段的風動、輪廓、前景位移、補繪／根部／色盤與實際動畫驗收，細節見[13 參考風動](13-reference-wind.md)。

擁有者同時明確要求「自動合併和更新」，解除ADR-016／017當時記錄的暫不發佈限制。審查及相關測試通過後，自動建立PR、等待CI、合併並核對Pages部署；既有工作流與保護規則保持有效。

---

## 索引

| ADR | 主題 | 狀態 |
| --- | --- | --- |
| 001 | Vite + React + TypeScript | 已接受 |
| 002 | Canvas 2D 渲染 | 已接受 |
| 003 | 交叉淡入為暫定方案 | 已接受 |
| 004 | 原始 PNG 不可變、WebP 衍生 | 已接受 |
| 005 | GitHub Pages 與 base path | 已接受 |
| 006 | 無可見 UI | 整站限制已由016取代 |
| 007 | URL 參數除錯 | 已接受 |
| 008 | 暫不引入測試框架 | 已接受（暫定） |
| 009 | PixiJS 為 Stage 3 提議 | 提議 |
| 010 | 文件繁體中文、程式碼英文 | 已接受 |
| 011 | GitHub Pages 改用 gh-pages 分支 | 已取代（由 ADR-012） |
| 012 | 取得 workflow 權限後切回 Actions 自動部署 | 已接受 |
| 013 | 抽出純時間軸模組、靜止時停止 rAF | 已接受 |
| 014 | 預設 Minecraft 風格像素動態 Vermouth | 已由015取代其voxel預設 |
| 015 | 忠實2D像素Living Portrait，取代方頭voxel | 身份／動態仍適用；整站由016擴充、展示由017細化 |
| 016 | 完整個人網站、可個人化內容與可用性備援 | 已接受 |
| 017 | 原近景透明去背、無角色相框與持續循環 | 展示要求保留；動態／發佈由018細化 |
| 018 | 可見分層風動、局部補繪與恢復自動發佈 | 已接受 |
