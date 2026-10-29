# Changelog

本專案遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) 的精神，
版本號使用 `MAJOR.MINOR.PATCH`。

## 2026-10-29 · 圓形內可見的髮束飄動

- 依擁有者回饋保留已認可的眨眼，只改善頭髮持續隨風飄動。保持12秒慢風、24秒獨立眼事件、圓形無框、DPR清晰像素與全站個人化設定。
- 重塑預計算髮根到中段的柔韌權重，讓臉側與肩前捲髮在圓形內能清楚彎曲；加入較豐富的次級風波與360／720 ms分層拖尾。髮根固定、不整圖移動，不擴大region幅度或掃描padding。
- 新證據以 `artifacts/flowing-hair/` 為準；保留PR7原始結果作歷史，新增圓形可見區及中段位移的驗證，避免只用畫布外峰值或紋理差分代表飄逸效果。原始source／reference、canonical素材、眼瞼時鐘與UI不變。
- 42項單元、型別／build、素材驗證、58項肖像及65項整站檢查通過。圓形內長捲髮中段約6.99／5.53邏輯像素、臉側約2.02／2.48；兩秒非眼區差分3204→5426，最弱500 ms窗口258→669，並維持臉／髮根固定、零破洞、接縫與高Hz時間／像素一致。
- 完整12秒production量測維持約60.07次繪製／秒，callback中位數3.8 ms／p95 5.6 ms；不限幀237.71次／秒，3.6／5.6 ms。無長任務或正常頁面錯誤，不將吞吐量當實機高刷保證。
- 83個關鍵時間點加十姿態／十錨點去重57張原始Canvas PNG；完整24秒480幀圓形GIF採共用調色盤／delta編碼，339,619 bytes，逐解碼幀核驗無殘影。GIF有預覽格式的色彩量化，原始PNG與runtime不變，證據不隨網站下載。

## 2026-10-29 · 持續微風、獨立眨眼與居中圓形肖像

- 依擁有者最新回饋，移除2.3秒陣風、循環尾端靜止及發梢啟動門控，改為12秒穩態三諧波彈簧響應。風一直輕柔飄動，17段髮束、長捲髮拖尾與左右耳環分別延遲；減輕位移，並補足短髮束在像素網格中的可見運動。
- 眨眼使用獨立24秒時鐘，間隔6.9／9.0／8.1秒；100 ms閉合、20 ms保持、160 ms重開，不再每次收風就眨眼。普通t=0是自然風動，姿態1／10及減少動態維持canonical靜止；wind=0只停髮束與耳環，眨眼仍獨立。
- 首頁改為中軸版面，人物以無邊框／無底板圓形展示；初始HTML、無JS與故障備援相同。DPR感知的展示元件以整數物理像素倍率及起點顯示，保留nearest-neighbor；只在尺寸／DPR／字體變化時量測，不在動畫每幀重排。
- 整站導覽改為Minecraft物品欄樣式，統一像素SVG箭頭及固定步進標題，保留個人介紹、真實作品、社群聯絡和後續社交／遊戲設定入口。
- 更新ADR-020、現行指南與使用方式；舊2.3秒合同及當時量測明確封存，新證據使用 `artifacts/gentle-portrait/`，不以舊結果宣稱新版本已驗證。原始source／reference、canonical母版與既有workflows保持不變。
- 修正眼瞼曲線極小數值誤差造成的端點分支差異，避免高刷新率在全閉／開始睜眼的同一時刻出現不同眼線像素；時鐘與暫停／恢復語義不變。
- 41項單元、55項肖像、65項整站檢查，以及型別／production build／素材來源驗證通過。24個連續500 ms窗口都有實際發絲變化（最少285像素）；八髮束及兩耳環均動，長卷髮峰值6.84／7.46邏輯像素，27,519個保護像素與160根點零改變、補繪零洞。60／120／144／240 Hz模擬在相同時刻逐像素一致。
- production單頁1200×1000／DPR1，穩定2.5秒後量完整12秒風動週期：原生721次繪製／12.003秒（約60 FPS），callback中位3.9 ms／p95 5.2 ms；不限幀3263次／12.004秒（約272次／秒），3.5／4.0 ms。全程活動風，無長任務或正常JS／HTTP錯誤；實體高刷新率螢幕未量測，容器吞吐不當作實機FPS保證。

## 2026-10-29 · 像素世界、十七段連續風動與目錄重整

- 八組髮束由九段細化至十七段，以C1 Hermite曲線銜接；長捲髮增加有界延遲回捲及回彈，與眨眼、分別延遲的左右耳環配合。保留原近景、透明無框、42色／二值alpha與固定臉部，不更換canonical母版。
- 預計算變形跨度、曲線係數與局部像素清單，減少每幀重複工作；歷史legacy／voxel播放器改為明確模式才載入，不增加正常首頁的JS或參考幀請求。
- 整站細化Minecraft草地方塊、物品欄作品卡、像素圖示、按壓／鍵盤焦點與手機排版。個人資料新增型別化 `socials`／`gameProfiles`，支援後續B站／抖音／王者荣耀／火影忍者公開資料；空設定不產生假帳號、空遊戲區或無效連結，React與初始HTML使用相同內容。
- 程式按 `app`、`features/profile`、`features/portrait`、`shared`與歷史模式分離；工具分為assets／qa／tests／deploy。現行文件集中 `docs/guides`，舊階段文件、舊runtime及歷史證據明確封存，避免全部混入網站或當前驗證。原source／reference路徑及位元組、既有workflows保持不變。
- 37項單元、51項肖像及41項網站檢查通過；保護區27,519像素與160髮根保持不變，風動8,253像素／908輪廓像素變化，眼瞼差分只在眼區，100輪×13相位一致，60／120／144／240 Hz模擬相位及像素一致。
- production單頁、1200×1000／DPR1、無CPU節流：原生排程60次實際繪製／秒，callback中位數3.7 ms／p95 5.5 ms；活動風段3.9／5.9 ms。解除Chromium限幀後活動風段約269次callback／秒，屬吞吐測試估計，不是實體高刷新率螢幕保證；完整條件見 `artifacts/pixel-world/performance.json`。
- 新增276個120 Hz時間樣本、10個參考姿態及10個錨點，去重保存205張實際Canvas PNG，附完整HTML圖集、144張縮圖表、角色與首頁GIF。GIF與指定時間取樣不作即時FPS證據，所有證據位於網站打包範圍之外。
- 依擁有者要求清理已合併／內容相同的舊分支，先驗證完整本機bundle並為必要歷史建立archive tags；main保留為唯一長期分支，當前任務分支待PR合併後移除。清理與恢復依據記錄於 `docs/maintenance/branch-cleanup.json`。

## 2026-10-29 · 分層風動、卷髮拖尾與自動更新

- 依工程十張參考的動作語義重做八組髮束，加入每束九段延遲、上揚、風向回彈、兩條不同響應耳環，與原眨眼並行；保留原近景、透明無框與固定42色像素格。
- 新增隱藏髮後底圖，先清除舊位置再繪製動髮，避免靜止副本／破洞；canonical臉部與靜止畫布SHA不變，source／reference凍結檔保持不變。九張runtime PNG及來源雜湊納入清冊。
- Minecraft草方塊品牌色帶與按鈕按壓回饋，保留完整個人網站、真實內容與後續功能空間；同步ADR-018與文件13。
- 32項單元、48項肖像與37項網站瀏覽器檢查通過。睜眼風動8,243像素變化／903個輪廓變化；前景卷髮控制點峰值22–23邏輯像素，風動在眨眼前後持續。保護區／160根點零位移、眼瞼變化限眼區、補繪區零破洞，100輪各13相位一致。
- fresh production5秒300次繪製／60fps，callback中位數4.55 ms／p95 6.5 ms，無長任務；條件與證據見 `archive/evidence/portrait-v5/`。不將GIF取樣率或舊版效能當作新即時結果。
- 使用者最新明確恢復自動合併與網站更新，解除前版草稿發佈限制；通過本地／CI審查後依既有main→GitHub Pages工作流更新。

## [Unreleased]

## 2026-10-29 · 原近景透明輪廓與網站細化（本地草稿，尚未發佈）

### Changed

- 依使用者再次澄清，保留前版Vermouth近景大小、1:1構圖與裁切；將外部深藍背景及捲髮間隙移除，採透明像素輪廓，移除人物方形相框、底板與卡片，不採擴圖完整胸像。
- 新去背編輯母版保存在 `assets/generated/portrait-v4/`，runtime改用 `public/assets/portrait-natural/`；維持42色與192²／256²／320²二值alpha網格，原始來源與v2母版保持不變。
- 透明 `portrait-rest.png` 768²供初始HTML、無JS與故障備援；分享OG另行合成。首次Canvas實際繪製前保留poster，避免離屏載入後空白或繪製成功後重複疊人。
- 正常首頁移除公開播放／暫停UI，2300 ms動畫在可見時持續循環；保留減少動態、隱藏／離屏停止與原相位續播、明確debug／QA的pause／t／pose。
- 細化首頁視覺與自然光暈，保留完整個人介紹、真實作品、聯絡、自託管字體及集中個人化設定／共享版面擴充空間；同步文件與ADR-017。

### Verified

- 31項單元測試、型別、production build與素材／來源驗證通過。
- 完整首頁37項瀏覽器檢查全通過，正常頁面無錯誤；核對四種寬度、原近景比例、無框透明人物、鍵盤導覽、跨多輪續播、離屏／減少動態及四種預期故障備援。256²畫布6,518個透明／59,018個不透明像素，零半透明像素。
- 獨立肖像42項檢查通過，無錯誤；37,698個固定人物像素及髮根零改變，1,085個眨眼變化像素全部在眼區，2,179個風動像素來自局部髮區／耳環，100輪各13個相位逐像素一致。
- 實際網站十個參考時刻、原圖／靜止／風動／閉眼對照及動畫保存於 `archive/evidence/portrait-v4/`；GIF取樣67個時間點，編碼40幀、2300 ms、768,526 bytes，擷取過程無瀏覽器錯誤；不當作即時FPS量測。
- fresh單頁production容器1200×1000／DPR1、無節流，穩定1.5秒後取樣5秒：300次繪製／60.0fps、callback CPU中位數0.7 ms／p95 1.8 ms，無長任務、瀏覽器／HTTP錯誤；兩張runtime PNG共103,320 bytes，保留指定條件與實體裝置限制。
- 完整首頁、桌機、手機及無JS截圖已更新；下方舊數值為歷史基線。本輪仍遵守暫不發佈指示，沒有推送／合併／部署。

## 完整個人網站草稿（2026-10-28不透明肖像版本，尚未發佈）

### Added

- 依使用者最新澄清，建立完整簡潔Minecraft像素風個人網站：導覽、介紹、真實作品、Email／GitHub與頁尾；Vermouth保留為hero主視覺。
- 使用者指定的fknejdcwnfi稱呼、HELLOWORLD與Email；`src/features/profile/content/site.ts`集中個人資料、導覽與作品，`SiteShell`保留後續功能插槽。
- 自託管Press Start 2P及SIL OFL授權、像素邊框與綠色點綴，中文保持可讀；手機版可捲動瀏覽全部內容。
- 初始HTML完整內容、整站／肖像錯誤邊界、12秒素材逾時與獨立靜態肖像降級，降低module／動畫失敗造成空白的風險。
- 文件12與ADR-016；保留肖像子系統及原始來源保護，不新增假履歷、假作品或未接後端的送信表單。

### Changed

- 首頁不再只展示單張角色；`?view=portrait`保留獨立美術檢視，完整debug控制仍須明確啟用。
- 最新暫不發佈指示優先；這是本地可檢閱草稿，不代表線上內容或環境已再次發佈。新首頁驗證結果以實際執行後的紀錄為準。

### Verified

- 31項單元測試、型別、production build與素材／來源雜湊檢查通過；完整首頁34項瀏覽器檢查通過，正常頁面沒有錯誤；補齊小字對比、鍵盤跳轉焦點及靜態播放控制。
- 核對320／390／768／1440寬度、真實作品與Email／GitHub、鍵盤導覽、播放控制、減少動態、自託管字體及肖像離屏暫停／返回續播。
- 停用JS、主module被攔截、PNG503、眼瞼圖12秒逾時與Canvas不可用時，完整內容／靜態肖像仍保留；獨立肖像33項回歸亦通過。
- 實際首頁、完整桌機、手機與無JS截圖及QA紀錄保存在 `artifacts/personal-site/`；本輪沒有推送／合併／發佈。

## 2D像素肖像迭代（已交付歷史）

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
- 素材管線 `scripts/assets/optimize_assets.py`：1080² WebP、manifest、1200×630 OG 圖。
- 原始素材清冊、時間軸規格、目標架構、開發指南、Codex 交接、QA 清單與 ADR。
- 根目錄 `AGENTS.md`：Codex Cloud 自動載入的代理規則與閱讀順序。
- GitHub Pages 自動部署：推送 `main` 由 `.github/workflows/deploy.yml` 建置與發佈。
- PR 建置檢查：`.github/workflows/ci.yml`。
- `npm run deploy` 保留為 `gh-pages` 手動備援。
- `favicon.svg`（藍寶石墜飾）與 OG metadata。
- `scripts/assets/verify_assets.py` 與 `npm run assets:verify`：驗證 manifest 雜湊、第 1/10 幀一致與必要靜態檔；CI 與部署 workflow 都會執行。
- SEO 收尾：canonical、`og:site_name`、`og:image:alt`、Twitter metadata、`robots.txt`、`sitemap.xml`。

### Changed

- 將原本扁平的 `vermouth_10frame_animation_refined/` 重構為 `assets/source/`、`public/assets/`、`src/`、`docs/`、`scripts/`。
- 原始 PNG 不再直接提供給瀏覽器；改由 WebP 衍生檔服務（約 16.9 MB → 1.4 MB）。
- 原始 prompt 文件移入 `docs/reference/`，凍結保存。
- GitHub Pages 由 `gh-pages` 分支切換為 GitHub Actions（`build_type: workflow`）；`gh-pages` 保留為手動備援。
- 抽出 `src/archive/legacy/timeline.ts`：純時間軸取樣，不依賴 DOM／Vite，方便日後單元測試。
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
