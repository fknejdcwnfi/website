# Changelog

本專案遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) 的精神，
版本號使用 `MAJOR.MINOR.PATCH`。

## [Unreleased]

### Added

- 以original_reference為最高身份／構圖權威的AI輔助2D像素canonical portrait及局部眼瞼材料；不再以Steve方頭方身作預設。
- 統一像素網格與受控調色盤，依原圖近景、尖下巴、斜眼、捲髮及不對稱首飾配置設計；保留192／256／320實際輸出比較入口。
- 恢復2300 ms參考錨點風場，局部髮束延遲／阻尼、固定根點、630–850 ms眨眼及耳環微動；未知遮擋區維持安全位移限制。
- 僅debug模式可見的風力、方向、陣風、剛度、阻尼、眨眼、速度、暫停控制。
- ADR-015與Living Portrait現行契約，規範原圖／靜止／風動／閉眼及十個真實網站截幀／動畫證據。
- 42色調色盤、六個192／256／320網格PNG與來源SHA清冊；共享Canvas匯出、實際網站截幀與瀏覽器回歸腳本。
- 新768² `og-portrait.png`及實際網站十幀、原圖對照、2300 ms GIF；metadata同步為2D Living Pixel Portrait。

### Changed

- 預設改為`style=portrait`；前次`?style=voxel`與原動漫`?style=legacy`作歷史比較保留。
- 最新提示詞排除3D voxel、Steve造型、無關場景及簡單濾鏡；原始素材與凍結文件完全保留。
- 前次voxel的29項功能／24fps效能資料保留為歷史，不移作新版驗證結論。

### Verified

- 24項單元測試、型別、build、素材與來源雜湊驗證通過；33項瀏覽器功能檢查通過，含真實播放器60／120 Hz相位與像素一致性。
- 35,998個受保護像素於風動時不變，八組髮區及耳環均有像素變化；閉眼僅改兩個眼區，0／1890／2300 ms一致。
- 實際網站GIF由67個時間點取樣，編碼總長2300 ms；它是時間軸預覽，不冒充即時FPS證據。
- fresh單頁production容器5秒樣本：300次繪製／60.0 fps、callback CPU中位數0.7 ms／p95 1.0 ms、無長任務；兩張runtime材料共107,636 bytes。保留量測條件與實體裝置限制，不宣稱所有裝置效能。

## 前次 voxel 迭代（歷史，已由2D立繪取代）

### Added

- 預設Minecraft風格程序化像素／voxel Vermouth：192²邏輯畫布、nearest-neighbor放大、固定臉部、獨立髮束、局部眼皮、耳環與背景像素動態。
- 4800ms循環、220ms眨眼窗口、24fps節流；減少動態、固定姿態及隱藏分頁停止無意義更新。
- 主題midnight／emerald／amethyst與URL個人化wind、speed、seed，所有輸入先驗證。
- Node24內建八個單元檢查與 `npm test`；prebuild自動執行測試，沿用既有CI而不修改workflow。新像素舞台產品、架構、個人化與QA契約。
- 從實際程序化renderer產生768² `og-pixel.png`分享圖與桌機／手機文件截圖；素材驗證要求新OG圖存在。

### Changed

- 擁有者明確將視覺方向由anime原圖rig轉向Minecraft風格像素動態；新增ADR-014，舊規格與P1圖層計畫標為歷史，未宣稱完成clean plate或PixiJS rig。
- 原Stage1預覽保留於 `?style=legacy`，仍標為provisional。原始PNG、GIF、參考文件與既有WebP不變。
- 同步README、代理規則、開發與素材文件；保留網站外殼、主題、動態參數及個人內容的獨立演進空間。

### Verified

- 新像素舞台production的29項瀏覽器功能檢查通過，預設模式不請求舊來源姿態圖。
- 容器Chromium的fresh production五秒樣本：120次繪製、23.99fps；CPU繪製時間median0.5ms、p951.2ms，未觀察到長任務。這不是實體手機效能或所有裝置保證。

### Planned

- 持續以實際截圖、動態與裝置量測改善像素角色辨識度、局部動態及效能。
- 以下原anime路線為保留研究，並非新像素renderer的必經步驟：Stage 2圖層、遮罩、clean plate與補繪。
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
