> **歷史快照：2026-10-29，PR #6版本。** 本文的2300 ms風動、每輪眨眼及數值只適用當時版本；目前持續微風、獨立眨眼與圓形展示以[現行指南](../guides/reference-wind.md)為準。原始證據仍保留，不以歷史通過項數替代新驗證。

# Vermouth — 2D Pixel Art Living Portrait

- **日期**：2026-10-29
- **目前方向**：忠於原始角色的 Minecraft-inspired 高精緻 **2D 像素立繪**
- **決策**：[ADR-015](../decisions.md#adr-015--以忠實-2d-像素立繪取代方頭-voxel-預設)、[ADR-017](../decisions.md#adr-017--保留原近景去背與持續循環動態)

> **目前實作**：同一v4近景身份，新增八個分層髮束、每束十七段延遲彎曲、獨立左右耳環與隱藏補繪底圖。最新行為、可見度門檻與驗證見[參考風動](../guides/reference-wind.md)。擁有者已恢復自動合併／網站更新授權。

這份契約規範完整個人網站中的肖像子系統；整站內容、導航與擴充以 [個人網站](../guides/personal-site.md) 為準。它取代文件10的方頭 voxel 預設。使用者最新提示詞明確排除 Steve 方頭方身、3D voxel、Q版大頭、單純縮圖／馬賽克濾鏡與十張 AI 圖輪播；「Minecraft-inspired」指像素群組、輪廓與明暗語言，不是把 Vermouth 改成玩家模型。

肖像品質順序為：**角色還原度 → 像素美術 → 動畫自然度 → 視覺一致性 → 效能**。整站已依ADR-016擴充為正常個人網站；本子系統不承擔導航／作品／聯絡功能。依ADR-017，首頁與獨立檢視 `?view=portrait` 均保留前版近景大小與1:1構圖，去除人物外背景，不擴圖改成完整胸像。方形邏輯畫布的外部像素透明，角色外不加方形相框、底板或卡片。正常首頁沒有播放／暫停按鈕，畫面內持續循環；完整調試僅在 `?debug=1` 出現。

## 1. 參考權威與實際位置

提示詞中的 `references/` 在此專案對應如下；沿用既有路徑，不複製或更名來源：

| 提示詞素材 | 實際路徑／用途 |
| --- | --- |
| `original_reference.jpg` | [assets/source/original_reference.jpg](../../assets/source/original_reference.jpg)：**最高身份、五官、髮型、首飾、構圖基準** |
| 十張關鍵圖 | `assets/source/frames/frame_01.png`…`frame_10.png`：只提取風動、眨眼及回落意圖 |
| contact sheet | [assets/source/preview/10_frame_contact_sheet.jpg](../../assets/source/preview/10_frame_contact_sheet.jpg) |
| GIF | [assets/source/preview/10_frame_preview.gif](../../assets/source/preview/10_frame_preview.gif)：姿態參考，不是完成品 |
| 分鏡文字 | [docs/reference/10_frame_prompts.md](../reference/10_frame_prompts.md)：唯讀歷史 |

全部來源維持唯讀，`frame_01`／`frame_10` 位元組一致性仍驗證。參考 GIF 實際為2290 ms、末幀400 ms；網站採2300 ms契約，不修改原始GIF以消除差異。

角色特徵須逐項對照：尖下巴與原始臉緣、傾斜冰藍眼裂／高光與上眼線、眉毛方向、鼻形、克制且自信的微笑、偏分中央瀏海、不對稱臉側細髮、肩前捲髮、不同高度的修長藍耳墜、銀鏈與靠近畫面下緣的藍色吊墜，以及右側較高的肩線。不得只保留「金髮、藍眼」配色便宣稱還原完成。

## 2. 一份角色資產，不是逐幀換臉

像素美術由原始參考圖作 **AI輔助風格轉譯**，產生一份全開眼睛的 canonical portrait。它經像素群組設計後，再規範至統一邏輯網格與受控調色盤；不是直接將原始動漫圖 resize 後放大。

另一份閉眼編輯圖只作兩個局部眼瞼的材料來源。renderer 僅採用經檢查的眼區，區外始終來自同一份 canonical portrait；不把閉眼 donor 的眉、鼻、嘴、臉緣、髮型或飾物替換進網站。動畫不呼叫圖片生成服務，也不輪播不同AI角色。

| 層級 | 實際路徑 | 說明 |
| --- | --- | --- |
| 未修改編輯母版 | `assets/generated/portrait-v4/open.png`、`closed.png` | v2近景母版的背景移除編輯及局部閉眼donor；保存原有大小／裁切，來源、方法與雜湊可追溯 |
| 網站資產 | `public/assets/portrait-natural/base.png`、`eyelids.png`、`underpaint.png` | 載入同一角色、眼瞼及髮後補繪材料；透明區不填入方形背景 |
| 網格與來源清冊 | `public/assets/portrait-natural/manifest.json` | 記錄九張192²／256²／320² PNG（角色、眼瞼、髮後底圖）、母圖與原始reference的尺寸／SHA-256；調色盤為42色，alpha為二值 |
| 靜態備援 | `public/portrait-rest.png` | 同一實際renderer的768²透明靜止近景；OG分享圖另行合成 |
| 目前QA證據 | `artifacts/pixel-world/` | 密集實際截幀、原圖／動態對照、像素／生命週期與高更新率檢查；舊證據另作歷史 |

AI轉譯與像素媒介仍可能留下形狀、像素群組或色階差異；不得宣稱原圖幾何已1:1量測一致、主觀藝術品質「完美」，或用尚未上網站的生成圖代替實際渲染證據。

## 3. 像素網格與圖層安全

預設邏輯解析度為 **256²**，替代網格為192²與320²，使用同一42色調色盤。維持v2原有近景尺寸、頭髮上緣裁切及肩線，不向外補畫整個胸像。人物輪廓外與捲髮空隙保留透明，alpha採透明／不透明二值；方形畫布只是內部座標，不得補上方形底板或人物卡片。三種網格需檢查眼線、高光、髮尖與像素群組；舊不透明圖不構成新去背邊緣的驗證。顯示採 nearest-neighbor，關閉平滑濾波，所有動態都回到同一像素網格。

臉、下顎、眉、鼻、嘴、身體、項鏈等固定區保持零位移；眼瞼是固定眼區內的獨立例外。至少區分後髮、左右外髮、主瀏海、細瀏海、左右臉側髮、肩部捲髮及下方髮尾等影響區。非矩形遮罩與根部權重依實際像素立繪設計，不機械切成會露邊的矩形圖片。

採用八個分層髮束的有界反向像素取樣。先移除髮束的舊位置，僅在空出的區域使用隱藏底圖，再將每束髮按十七個鏈段的延遲／彎曲取樣繪回；不把新髮直接疊在固定舊髮上。變形權重可平滑，像素顏色保持nearest-neighbor。前景卷髮的自由輪廓不再被舊輪廓邊界鎖死，附著點與臉部保持固定，肩旁允許頭髮遮擋／露出，身體底圖不移動。左右耳環分用第9／10通道，與眼瞼獨立。

新增髮後底圖僅是局部AI輔助修復，不替換canonical臉部，不代表完整來源一致的分層補繪。對應遮擋／可見度驗證與限制見[參考風動](../guides/reference-wind.md)。不能以整張人物平移、旋轉或縮放冒充髮絲動畫。

## 4. 參考時間軸、風場與眨眼

主循環 **2300 ms**，可見時持續重播，不在第一輪結束後停住。1890–2300 ms的靜止是每輪內的自然回落段。動作錨點如下，採連續曲線／彈簧阻尼取樣，不逐張播放來源圖：

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

正常網址顯示完整個人首頁；`?view=portrait`才是獨立肖像。肖像內不加月亮、建築、漂浮裝飾或與原圖無關的場景。`?style=voxel` 保留前次方頭版本作歷史比較，`?style=legacy` 保留原動漫交叉淡入預覽；兩者都不是目前美術驗收目標。

| 選項 | 預設／用途 |
| --- | --- |
| `view` | 未指定為完整個人首頁；`portrait`為獨立肖像檢視 |
| `style` | `portrait`；另可選`voxel`／`legacy` |
| `pixel` | 256；192²／256²／320²邏輯網格比較 |
| `wind` | 1；0–1風力增益，0停止髮絲及耳環風動 |
| `direction` | 1；−1–1，負值反向，0關閉風場 |
| `gust` | 0.35；0.1–2 Hz柔和陣風 |
| `stiffness`／`damping` | 18／5；範圍5–40／1–12，髮束剛度與阻尼 |
| `speed` | 1；0.25–2播放倍率 |
| `theme`／`seed` | theme調整舞台外配色；seed保留供歷史voxel使用，現行肖像不加入隨機裝飾或改變身份 |
| `pose` | 1–10凍結參考姿態；1／10畫布一致 |
| `t` | 預設不指定；有限值0–2300 ms精確凍結時間軸，超界裁切；pose優先於t |
| `pause` | 0；明確debug／QA暫停覆寫，不是正常首頁的公開按鈕 |
| `debug` | `1`才顯示調試控制與狀態，包括手動眨眼 |

可用範圍與實際防呆以控制模組為準；所有值先驗證有限值、整數與上限，再進渲染器。正常首頁沒有公開播放／暫停UI，手動暫停仍可由明確debug／QA參數控制。`prefers-reduced-motion: reduce`首次載入即採靜止01，眼睛與髮絲／耳環一併停止；明確姿態覆寫仍保持整個場景靜止。隱藏分頁或角色離屏時停止繪製，恢復後沿原相位續播，不補算隱藏時間或建立重複迴圈；銷毀後移除監聽、觀察器與排程。

## 6. 實作與證據的交付邊界

保留 Vite、React、TypeScript與Native Canvas2D，優先複用現有播放器生命週期，不因提示詞建議而安裝不必要的框架或建立空目錄。美術資產、遮罩／rig、風場／眼瞼時間軸、畫布繪製及React展示責任分離；實際檔案清單與測試結果應在PR中對應。

| 模組 | 實際責任 |
| --- | --- |
| `src/features/portrait/renderer/portraitAsset.ts` | 42色調色盤、影像載入與共享網格匯出；不直接像素化原始動漫圖 |
| `src/features/portrait/renderer/portraitRig.ts` | 八個分層髮區、固定人物保護、耳環影響區及眼罩；一次準備陣列、逐幀逆向像素取樣 |
| `src/features/portrait/animation/portraitTimeline.ts` | 2300 ms風力與眼瞼取樣、十條預算彈簧／阻尼通道（八組髮束與左右耳環）；不依賴顯示刷新率 |
| `src/features/portrait/animation/portraitPlayer.ts` | rAF與delta time、素材載入、保留相位的參數更新、靜止／可見性／銷毀 |
| `src/features/portrait/animation/stageOptions.ts` | 有限值、範圍、網格與模式驗證 |
| `src/features/portrait/components/PortraitControls.tsx` | 只有debug模式顯示的有標籤控制項；不出現在正式展示頁 |

renderer先預算髮層的目的列跨度及每列第一步反向取樣，再只更新局部眼瞼／耳環像素清單，避免每幀反覆算相同座標。優化維持原有動作與像素，不加低幀率上限；實際顯示更新率、無節流吞吐量及60／120／144／240 Hz相位一致性分別量測，不能混稱裝置FPS。

新去背母版的編輯條件與限制保存於 `assets/generated/portrait-v4/README.md`及 `PROMPTS.md`，v2不透明近景母版保留歷史。可重跑的匯出／QA腳本如下；腳本需以新素材路徑、原有1:1構圖及透明輸出為準，不把舊輸出冒充新證據：

```bash
# 先於另一個終端執行 npm run dev；以下素材匯出／探針需Vite dev網址
python3 scripts/assets/export_portrait.py --url http://127.0.0.1:5173/
python3 scripts/qa/verify_portrait_browser.py --url http://127.0.0.1:5173/
python3 scripts/qa/capture_portrait.py --url http://127.0.0.1:5173/
```

Python需Playwright、Chromium及Pillow；匯出腳本執行瀏覽器中的共享Canvas流程，Python只寫出PNG／雜湊；截幀腳本以Pillow編碼實際Canvas影格，不重畫或過濾人物。截幀可改用production preview的`/website/`；功能探針需讀取source模組，故使用dev server。正常網站的靜態備援為 `public/portrait-rest.png`，768²且透明。`public/og-portrait.png`為另行合成紙色背景的768²分享圖；舊 `og-pixel.png`保留作歷史資源。

建立以下證據，全部為真實網站輸出：

```text
artifacts/pixel-world/
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
| 自然角色展示 | 首頁及`view=portrait`保留原近景1:1畫布、人物外透明、無方形相框／卡片；正常首頁無播放按鈕 | 桌機／手機及三種網格；近景尺度、原裁切、透明邊緣、無水平捲動 |
| 靜止與生命週期 | reduced motion／明確pause／pose／hidden／offscreen／destroy不持續畫 | 初次及即時偏好、暫停保留相位、隱藏／離屏恢復與資源清理 |
| 效能 | 以60fps為目標，不為省成本犧牲美術 | 單頁production穩定後記錄繪製成本、更新率、長任務及量測條件 |
| 本地交付 | 單元、型別、build、資產／瀏覽器檢查與文件同步 | 已恢復自動合併授權；通過檢查與CI後合併／驗證部署 |

從repository根目錄執行 `npm test`、`npm run typecheck`、`npm run build`、`npm run assets:check`、`npm run assets:verify`；Node24、依賴及自動合併授權沿用。`prebuild`會跑測試，`assets:verify`不能取代美術／動態驗收。

## 8. v4小幅風場的歷史結果

此節為先前小幅風場版本記錄；目前分層風動及高更新率驗證以[參考風動](../guides/reference-wind.md)為準。完整網站的檢查／截圖路徑會隨版本更新。

- 31項單元測試、型別、production build及素材／來源驗證通過。
- 當時完整首頁QA37項全通過（原網站JSON隨後已更新；此處保留當時文字紀錄），正常頁面無錯誤；256²實際輸出有6,518個透明像素、59,018個不透明像素、零半透明像素。左下角沿用原近景肩線裁切而不透明，不以四角全透明為理由擴圖改構圖。
- 首頁連續三段2400 ms觀察的繪製次數25→170→314→458，跨多輪持續播放；減少動態、離屏停止／返回續播、四種寬度及四種預期故障備援通過。
- [獨立肖像QA](../../archive/evidence/portrait-v4/qa.json)42項通過，無瀏覽器錯誤；涵蓋三種網格、原近景裁切、五處原深藍空隙透明、來源與動畫均無半透明像素、debug與明確靜止覆寫、生命週期、歷史模式及手機。真實播放器60／120 Hz各步進1000 ms，elapsed與像素一致。
- 風動1020 ms改變2,179個像素；跨各參考時刻的活躍像素上限，八個髮區分別為127／398／807／278／115／97／241／183，耳環91，並非同一時刻的分區計數。37,698個受保護人物像素及零權重髮根零改變。眨眼改變1,085個像素，全部位於兩個精確眼區。
- 100輪各13個相位逐像素一致；0／1890／2300 ms靜止相同，風力0回到基底。減少動態首次載入rAF為0，隱藏／續播／停止／銷毀不留下重複排程。
- [截幀紀錄](../../archive/evidence/portrait-v4/capture.json)保存實際網站十個時刻、256²邏輯畫布、原始reference及輸出SHA；首尾一致且擷取過程無瀏覽器錯誤。
- [對照圖](../../archive/evidence/portrait-v4/comparison.png)及[GIF](../../archive/evidence/portrait-v4/animation_preview.gif)使用最終去背近景：67個時間點，合併相同畫格後編碼40幀、總長2300 ms、768,526 bytes。它是實際時間軸預覽，不是即時FPS證據。

- [新production效能](../../archive/evidence/portrait-v4/performance.json)：fresh單頁headless Chromium、1200×1000／DPR1、無節流，穩定1.5秒後取樣5秒，期間不截圖；300次繪製／60.0fps，rAF callback CPU中位數0.7 ms／p95 1.8 ms，無長任務、瀏覽器或HTTP錯誤。兩張runtime PNG共103,320 bytes。callback包含整個播放器回呼，不是GPU時間；這是指定容器樣本，不是所有裝置保證。

## 9. v2不透明肖像的歷史結果

以下數值、圖檔與檢查屬不透明v2的歷史，不是目前角色或動態的通過證明；當前結果與實際證據以參考風動指南及 `artifacts/pixel-world/`為準。

- `npm test` 24／24通過；型別、build、legacy素材及portrait來源／六個網格PNG雜湊驗證通過。
- [瀏覽器QA](../../archive/evidence/portrait-v2/qa.json) 33項通過，無頁面或資源錯誤；涵蓋三種網格、預設無UI、調試、暫停保留相位、手動眨眼、減少動態初次／即時切換、隱藏／恢復／銷毀、兩種歷史模式及手機DPR2。真實PortraitPlayer以60／120 Hz模擬步進1000 ms，得到相同elapsed與畫布像素。
- 風動1020 ms相較靜止改變2,282個像素；八個髮區分別有138／417／827／336／102／69／265／113個像素改變，耳環15個。35,998個受保護像素零改變，零權重根部像素零改變。
- 閉眼相較同時刻睜眼改變1,126個像素，全部位於兩個眼區；0／1890／2300 ms靜止相同，風力0時髮絲與耳環回到基底。減少動態首次載入的rAF排程為0，播放中切換後回到初始姿態並停止。
- [截幀紀錄](../../archive/evidence/portrait-v2/capture.json) 保存十個真實網站時間點、原始reference及輸出SHA。GIF取樣67個時間點，合併相同畫格後編碼40幀、總長2300 ms、769,880 bytes；它不是即時FPS測量。對照見 [comparison.png](../../archive/evidence/portrait-v2/comparison.png)。
- [production效能](../../archive/evidence/portrait-v2/performance.json)：fresh單頁headless Chromium、1200×1000／DPR1、無節流，穩定1.5秒後取樣5秒，期間不截圖。300次繪製、60.0 fps，rAF callback CPU中位數0.7 ms／p95 1.0 ms，沒有長任務；兩張runtime影像共107,636 bytes，無瀏覽器／HTTP錯誤，metadata與新OG圖片回應200。callback成本包含整個播放器回呼，不把它誤稱為GPU時間或純像素映射耗時。

效能重現需先build並啟動production preview，再執行：

```bash
python3 scripts/qa/measure_portrait.py --url http://127.0.0.1:4173/website/
```

以上是v2在單次容器與指定瀏覽器條件下的歷史結果，不能代替新透明近景、所有實體裝置、長時間熱節流或主觀還原度判斷。尚未製作的完整clean plate、人工美術修訂與未量測項仍維持明示，不沿用歷史數字作新版證據。
