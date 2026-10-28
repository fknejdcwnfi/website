# 11 · Vermouth — 2D Pixel Art Living Portrait

- **日期**：2026-10-28
- **目前方向**：忠於原始角色的 Minecraft-inspired 高精緻 **2D 像素立繪**
- **決策**：[ADR-015](08-decisions.md#adr-015--以忠實-2d-像素立繪取代方頭-voxel-預設)

這份契約取代文件10的方頭 voxel 預設。使用者最新提示詞明確排除 Steve 方頭方身、3D voxel、Q版大頭、單純縮圖／馬賽克濾鏡與十張 AI 圖輪播；「Minecraft-inspired」指像素群組、輪廓與明暗語言，不是把 Vermouth 改成玩家模型。

品質順序為：**角色還原度 → 像素美術 → 動畫自然度 → 視覺一致性 → 效能**。只開發角色展示，不加入導航、自介、卡片、登入、後端、資料庫或其他網站功能。正式畫面保持單一正方形角色與深色背景；調試控制僅在 `?debug=1` 出現。

## 1. 參考權威與實際位置

提示詞中的 `references/` 在此專案對應如下；沿用既有路徑，不複製或更名來源：

| 提示詞素材 | 實際路徑／用途 |
| --- | --- |
| `original_reference.jpg` | [assets/source/original_reference.jpg](../assets/source/original_reference.jpg)：**最高身份、五官、髮型、首飾、構圖基準** |
| 十張關鍵圖 | `assets/source/frames/frame_01.png`…`frame_10.png`：只提取風動、眨眼及回落意圖 |
| contact sheet | [assets/source/preview/10_frame_contact_sheet.jpg](../assets/source/preview/10_frame_contact_sheet.jpg) |
| GIF | [assets/source/preview/10_frame_preview.gif](../assets/source/preview/10_frame_preview.gif)：姿態參考，不是完成品 |
| 分鏡文字 | [docs/reference/10_frame_prompts.md](reference/10_frame_prompts.md)：唯讀歷史 |

全部來源維持唯讀，`frame_01`／`frame_10` 位元組一致性仍驗證。參考 GIF 實際為2290 ms、末幀400 ms；網站採2300 ms契約，不修改原始GIF以消除差異。

角色特徵須逐項對照：尖下巴與原始臉緣、傾斜冰藍眼裂／高光與上眼線、眉毛方向、鼻形、克制且自信的微笑、偏分中央瀏海、不對稱臉側細髮、肩前捲髮、不同高度的修長藍耳墜、銀鏈與靠近畫面下緣的藍色吊墜，以及右側較高的肩線。不得只保留「金髮、藍眼」配色便宣稱還原完成。

## 2. 一份角色資產，不是逐幀換臉

像素美術由原始參考圖作 **AI輔助風格轉譯**，產生一份全開眼睛的 canonical portrait。它經像素群組設計後，再規範至統一邏輯網格與受控調色盤；不是直接將原始動漫圖 resize 後放大。

另一份閉眼編輯圖只作兩個局部眼瞼的材料來源。renderer 僅採用經檢查的眼區，區外始終來自同一份 canonical portrait；不把閉眼 donor 的眉、鼻、嘴、臉緣、髮型或飾物替換進網站。動畫不呼叫圖片生成服務，也不輪播不同AI角色。

| 層級 | 實際路徑 | 說明 |
| --- | --- | --- |
| 未修改生成母版 | `assets/generated/portrait-v2/open.png`、`closed.png` | 原圖參考轉譯及閉眼材料，需保存生成方法、來源與雜湊 |
| 網站資產 | `public/assets/portrait/base.png`、`eyelids.png` | 由實際角色資產處理／渲染流程規範；只載入同一角色及眼瞼材料 |
| 網格與來源清冊 | `public/assets/portrait/manifest.json` | 記錄六張192／256／320網格PNG、母圖與原始reference的尺寸／SHA-256；調色盤為42色 |
| QA證據 | `artifacts/` | 原圖、靜止、風動、閉眼、十個對應時刻與動畫預覽；必須來自實際網站 |

AI轉譯與像素媒介仍可能留下形狀、像素群組或色階差異；不得宣稱原圖幾何已1:1量測一致、主觀藝術品質「完美」，或用尚未上網站的生成圖代替實際渲染證據。

## 3. 像素網格與圖層安全

預設邏輯解析度為 **256×256**。已實際比較192／256／320輸出：192的眼線與高光較粗，320保留更多細節，256兼顧眼神、髮尖與可見像素群組，因此採為預設。三種網格均經同一42色調色盤匯出。顯示採 nearest-neighbor，關閉平滑濾波，所有動態都回到同一像素網格；不讓局部髮絲變成高清影像或因浮點縮放拉長像素。

臉、下顎、眉、鼻、嘴、身體、項鏈等固定區保持零位移；眼瞼是固定眼區內的獨立例外。至少區分後髮、左右外髮、主瀏海、細瀏海、左右臉側髮、肩部捲髮及下方髮尾等影響區。非矩形遮罩與根部權重依實際像素立繪設計，不機械切成會露邊的矩形圖片。

採用有界 **inverse pixel mapping**：每個輸出像素由單一來源取樣，避免把位移髮片蓋在原有髮片上留下雙輪廓。安全髮區與已知深色背景可以共同受局部場影響；區域邊界及髮根權重歸零。固定人物區不能被髮場拉動，也不以整張人物平移、旋轉或縮放冒充頭髮動畫。

未知肩頸／臉側後方沒有完整 clean plate，便維持遮擋或縮小／凍結該區運動。這種安全限制不是已完成所有分層補繪的證據；不得為放大動作臆造新臉、肩形或首飾。局部取樣、眼瞼、髮區與耳環各有獨立資料，與播放生命週期分離。

## 4. 參考時間軸、風場與眨眼

主循環 **2300 ms**，動作錨點如下。採連續曲線／彈簧阻尼取樣，不逐張播放來源圖：

| 姿態 | 時間ms | 風力參考 | 動作意圖 |
| --- | ---: | ---: | --- |
| 01 | 0 | 0 | 初始靜止，眼睛全開 |
| 02 | 230 | 0.18 | 微風起、細髮先動 |
| 03 | 460 | 0.45 | 長髮逐漸向右抬起 |
| 04 | 630 | 0.65 | 進入眨眼窗口，QA姿態可固定半閉 |
| 05 | 740 | 0.70 | 全閉眼，頭髮仍然運動 |
| 06 | 850 | 0.75 | 回到同一份全開眼睛 |
| 07 | 1020 | 0.90 | 風力高峰、髮束延遲分層 |
| 08 | 1300 | 0.50 | 減弱並輕微回彈 |
| 09 | 1570 | 0.20 | 阻尼回落 |
| 10 | 1890 | 0 | 回到初始像素，保持至2300 |

連續眨眼採 **630–850 ms共220 ms，740 ms全閉**；630 ms是連續閉合的起點，與參考表「630 ms已半閉」的文字差異已明示。固定姿態4保留半閉方便QA，不能以一個時刻同時承諾全開與半閉。速度倍率1時窗口為220 ms；改播放倍率會同時改變可見時間。

風場依十個風力錨點，加入髮束延遲、不同剛度／阻尼與柔和陣風。先算出可重現的週期運動，再按根到尾權重映射像素；不同更新率不改動畫速度。1890 ms前位移／速度收斂到零，1890–2300保持靜止，與下一輪初始狀態完全相同。

眼皮沿原始傾斜眼裂下降，逐步遮住虹膜，閉合材料保留瞼面、輪廓與睫毛；不壓扁整顆眼睛、不突然刪掉虹膜、不用普通直黑線代替閉眼。雙眼大致同步，重開時恢復同一份canonical眼睛；眉、鼻、嘴、臉型不變。耳環以耳垂為固定根點，下段輕微延遲擺動；寶石形狀及項鏈保持穩定。

## 5. 展示、個人化與隱藏調試

正常網址只顯示角色；不加月亮、建築、漂浮裝飾或與原圖無關的場景。`?style=voxel` 保留前次方頭版本作歷史比較，`?style=legacy` 保留原動漫交叉淡入預覽；兩者都不是目前美術驗收目標。

| 選項 | 預設／用途 |
| --- | --- |
| `style` | `portrait`；另可選`voxel`／`legacy` |
| `pixel` | 256；192／256／320邏輯網格比較 |
| `wind` | 1；0–1風力增益，0停止髮絲及耳環風動 |
| `direction` | 1；−1–1，負值反向，0關閉風場 |
| `gust` | 0.35；0.1–2 Hz柔和陣風 |
| `stiffness`／`damping` | 18／5；範圍5–40／1–12，髮束剛度與阻尼 |
| `speed` | 1；0.25–2播放倍率 |
| `theme`／`seed` | theme調整舞台外配色；seed保留供歷史voxel使用，現行肖像不加入隨機裝飾或改變身份 |
| `pose` | 1–10凍結參考姿態；1／10畫布一致 |
| `t` | 預設不指定；有限值0–2300 ms精確凍結時間軸，超界裁切；pose優先於t |
| `pause` | 0；暫停／恢復 |
| `debug` | `1`才顯示調試控制與狀態，包括手動眨眼 |

可用範圍與實際防呆以控制模組為準；所有值先驗證有限值、整數與上限，再進渲染器。調試控制不能成為正式頁面的常駐UI。`prefers-reduced-motion: reduce`首次載入即採靜止01，眼睛與髮絲／耳環一併停止；明確姿態覆寫仍保持整個場景靜止。隱藏頁面暫停，恢復後不補算隱藏時間或建立重複迴圈；銷毀後移除監聽與排程。

## 6. 實作與證據的交付邊界

保留 Vite、React、TypeScript與Native Canvas2D，優先複用現有播放器生命週期，不因提示詞建議而安裝不必要的框架或建立空目錄。美術資產、遮罩／rig、風場／眼瞼時間軸、畫布繪製及React展示責任分離；實際檔案清單與測試結果應在PR中對應。

| 模組 | 實際責任 |
| --- | --- |
| `src/character/portraitAsset.ts` | 42色調色盤、影像載入與共享網格匯出；不直接像素化原始動漫圖 |
| `src/character/portraitRig.ts` | 八個非矩形髮區、固定人物保護、耳環影響區及眼罩；一次準備陣列、逐幀逆向像素取樣 |
| `src/animation/portraitTimeline.ts` | 2300 ms風力與眼瞼取樣、九條預算彈簧／阻尼通道；不依賴顯示刷新率 |
| `src/animation/portraitPlayer.ts` | rAF與delta time、素材載入、保留相位的參數更新、靜止／可見性／銷毀 |
| `src/animation/stageOptions.ts` | 有限值、範圍、網格與模式驗證 |
| `src/components/PortraitControls.tsx` | 只有debug模式顯示的有標籤控制項；不出現在正式展示頁 |

像素母版的生成條件與限制保存在 `assets/generated/portrait-v2/PROMPTS.md`，可重跑流程為：

```bash
# 先於另一個終端執行 npm run dev；以下素材匯出／探針需Vite dev網址
python3 scripts/export_portrait.py --url http://127.0.0.1:5173/
python3 scripts/verify_portrait_browser.py --url http://127.0.0.1:5173/
python3 scripts/capture_portrait.py --url http://127.0.0.1:5173/
```

Python需Playwright、Chromium及Pillow；匯出腳本執行瀏覽器中的共享Canvas流程，Python只寫出PNG／雜湊；截幀腳本以Pillow編碼實際Canvas影格，不重畫或過濾人物。截幀可改用production preview的`/website/`；功能探針需讀取source模組，故使用dev server。新分享圖為 `public/og-portrait.png`，768²，擷取自同一個實際renderer；舊 `og-pixel.png`保留作歷史資源。

建立以下證據，全部為真實網站輸出：

```text
artifacts/
  pixel_reference.png
  pixel_frame_01.png … pixel_frame_10.png
  comparison.png
  animation_preview.gif
```

`comparison.png`應並排原始參考、像素靜止、風動及閉眼，逐項核對臉型、眉眼、高光、嘴角、髮型、耳環、項鏈與構圖。截幀以實際時間軸錨點或明確QA姿態取得，不能將未使用的AI候選圖冒充網站畫面。GIF需記錄取樣率與實際時長，不能僅靠低頻GIF驗收220 ms眨眼。

## 7. 提示詞覆蓋與驗證矩陣

| 需求 | 實作／審查要求 | 驗證方法 |
| --- | --- | --- |
| 原始身份與構圖 | original_reference最高優先，保留近景尖下巴、斜眼、肩線及低位吊墜 | 原圖／實際靜止對照；清楚列出剩餘差異 |
| 真正2D像素美術 | 單一角色重繪、統一網格及調色盤；排除Steve／voxel／簡單濾鏡 | 192／256／320實際輸出比較與細節放大 |
| 八類局部髮動 | 非矩形影響場、髮根固定、髮尾延遲、未知區受限 | 不同時間逐像素比較，固定區與髮根不變，髮尾／不同組變化 |
| 獨立眨眼 | 220 ms局部眼瞼、虹膜逐步遮住、閉眼輪廓／睫毛 | 開／半閉／閉／重開截幀；區外像素不被donor替換 |
| 耳環與項鏈 | 耳垂固定、耳墜微擺、鏈條／吊墜穩定 | 根點／寶石輪廓及固定項鏈逐像素比較 |
| 循環與時間 | 2300 ms、1890回靜止、delta time不依刷新率 | 0／1890／2300一致，60／120Hz模擬與連續瀏覽器觀察 |
| 無UI角色展示 | 桌機／手機正方形、乾淨深色背景、僅debug顯示控制 | 1200×1000、390×844／DPR1及2、無水平捲動 |
| 靜止與生命週期 | reduced motion／pause／pose／hidden／destroy不持續畫 | 初次及即時偏好、暫停恢復、隱藏恢復與資源清理 |
| 效能 | 以60fps為目標，不為省成本犧牲美術 | 單頁production穩定後記錄繪製成本、更新率、長任務及量測條件 |
| 自動交付 | 單元、型別、build、資產／瀏覽器檢查與文件同步 | CI通過後自動合併並確認該提交Pages部署 |

從repository根目錄執行 `npm test`、`npm run typecheck`、`npm run build`、`npm run assets:check`、`npm run assets:verify`；Node24、依賴及自動合併授權沿用。`prebuild`會跑測試，`assets:verify`不能取代美術／動態驗收。

## 8. 本次已執行結果

- `npm test` 24／24通過；型別、build、legacy素材及portrait來源／六個網格PNG雜湊驗證通過。
- [瀏覽器QA](../artifacts/qa.json) 33項通過，無頁面或資源錯誤；涵蓋三種網格、預設無UI、調試、暫停保留相位、手動眨眼、減少動態初次／即時切換、隱藏／恢復／銷毀、兩種歷史模式及手機DPR2。真實PortraitPlayer以60／120 Hz模擬步進1000 ms，得到相同elapsed與畫布像素。
- 風動1020 ms相較靜止改變2,282個像素；八個髮區分別有138／417／827／336／102／69／265／113個像素改變，耳環15個。35,998個受保護像素零改變，零權重根部像素零改變。
- 閉眼相較同時刻睜眼改變1,126個像素，全部位於兩個眼區；0／1890／2300 ms靜止相同，風力0時髮絲與耳環回到基底。減少動態首次載入的rAF排程為0，播放中切換後回到初始姿態並停止。
- [截幀紀錄](../artifacts/capture.json) 保存十個真實網站時間點、原始reference及輸出SHA。GIF取樣67個時間點，合併相同畫格後編碼40幀、總長2300 ms、769,880 bytes；它不是即時FPS測量。對照見 [comparison.png](../artifacts/comparison.png)。
- [production效能](../artifacts/performance.json)：fresh單頁headless Chromium、1200×1000／DPR1、無節流，穩定1.5秒後取樣5秒，期間不截圖。300次繪製、60.0 fps，rAF callback CPU中位數0.7 ms／p95 1.0 ms，沒有長任務；兩張runtime影像共107,636 bytes，無瀏覽器／HTTP錯誤，metadata與新OG圖片回應200。callback成本包含整個播放器回呼，不把它誤稱為GPU時間或純像素映射耗時。

效能重現需先build並啟動production preview，再執行：

```bash
python3 scripts/measure_portrait.py --url http://127.0.0.1:4173/website/
```

以上是單次容器與指定瀏覽器條件下的結果，不能代替所有實體裝置、長時間熱節流或主觀還原度判斷。尚未製作的完整clean plate、人工美術修訂與未量測項仍維持明示，不沿用前次voxel數字作新版證據。
