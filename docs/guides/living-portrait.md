# Vermouth · 持續微風的像素肖像

- 日期：2026-10-29
- 目前方向：忠於同一原近景身份的Minecraft-inspired 2D像素肖像，居中、圓形、無邊框
- 決策：[ADR-015](../decisions.md#adr-015--以忠實-2d-像素立繪取代方頭-voxel-預設)、[ADR-020](../decisions.md#adr-020--持續緩慢微風獨立眨眼與居中圓形展示)

本指南規範完整個人網站中的肖像；導覽、內容及未來帳號設定見[個人網站](personal-site.md)，新動作與驗證見[持續微風](reference-wind.md)。使用者最新要求取代舊2300 ms參考循環和展示形狀限制：頭髮持續輕柔飄動，眨眼偶爾獨立發生，人物在頁面中軸以無框圓形視窗呈現。舊契約保存於[PR #6歷史快照](../archive/15-living-portrait-reference-timeline.md)。

## 1. 身份與來源

[original_reference.jpg](../../assets/source/original_reference.jpg)是身份與近景構圖的最高權威。保留尖下巴、傾斜冰藍眼裂及高光、克制微笑、白金捲髮、不同高度的修長藍耳墜、低位吊墜與肩線；不改成Steve／3D voxel、Q版角色或擴圖胸像。

`assets/source/**`與`docs/reference/**`的原路徑及位元組完全凍結。十張來源圖、[contact sheet](../../assets/source/preview/10_frame_contact_sheet.jpg)、[GIF](../../assets/source/preview/10_frame_preview.gif)與[分鏡](../reference/10_frame_prompts.md)只提供微風、延遲髮束、眨眼和回落的動作意圖，不輪播其中臉型不同的生成圖。frame_01與frame_10仍須逐位元相同。

角色顏色與幾何始終來自同一canonical `assets/generated/portrait-v4/open.png`。`closed.png`只提供兩個局部眼罩內的眼瞼；它的眉、鼻、嘴、臉緣與身體不替換到人物上。`portrait-wind/underpaint.png`只修補髮束移開後露出的區域，不替換整張臉或整個身體。來源、用途與雜湊見[素材清冊](asset-inventory.md)。

## 2. 清楚的像素與圓形展示

內部畫布仍是256²，另有192²／320²比較網格；固定42色、alpha只取0或255，nearest-neighbor，關閉Canvas平滑。圓形由展示容器裁切，不重新裁切或改寫canonical素材，不為圓形補畫新臉。圓形邊緣由瀏覽器合成裁切；它不改變內部像素顏色與二值alpha契約。

首頁人物置於頁面中軸，展示容器沒有描邊、相框、厚底板或整圖漂移。同一展示容器內圖片與Canvas共用尺寸；初始poster、無JavaScript及錯誤降級使用同一圓形與水平置中規則。網站其他區域沿用草地／泥土、方角控制、物品欄與像素圖示，不將Minecraft理解為角色必須方頭方身。

可互動頁面依可用寬度與devicePixelRatio選擇整數實體像素倍率，避免一個邏輯像素被縮放成不均勻的分數實體像素。尺寸觀察只在容器或DPR變更時處理，不加入每幀layout計算；無JS提供響應式CSS尺寸及最近鄰顯示。此處追求清晰像素群組，不用模糊濾鏡、光暈或整圖CSS動畫掩蓋變形瑕疵。

## 3. 持續微風與獨立眨眼

目前風週期為12秒，取代舊2.3秒內快速起落再靜止的節奏。八組髮束與兩條耳環各有不同響應；17個鏈段以C1 Hermite曲線連接。風持續緩慢變化，週期邊界不得有固定靜止區、位置重設或速度跳變。臉、髮根、項鏈和固定身體維持穩定，長髮尾端只作有界的延遲彎曲及回彈。

眨眼使用與風分離的時鐘，24秒內在4400、11300、20300 ms開始三次事件，間隔6.9–9秒；每次100 ms閉合、20 ms保持、160 ms重開，共280 ms。風的相位跨12秒後重複，不代表眼睛也重複同一眨眼。正常播放的0 ms可已處於微風中，不強制回到poster的全靜止像素，以免接縫突然歸零。

眼瞼沿既有傾斜眼裂遮住虹膜，保留閉眼輪廓與睫毛，不壓扁整顆眼睛或用普通橫線代替。眨眼期間髮束與耳環照常流動，不靠換圖、換臉、整張人物平移／旋轉／縮放來製造動態。解析穩態響應預算為1 ms Float32表，再以線性取樣處理分數毫秒；接縫數值檢查涵蓋位置與速度。不同刷新率使用同一毫秒時間，沒有低FPS節流；離散像素仍按最近鄰格點顯示，不宣稱像素本身具有連續導數。

## 4. 靜止、除錯與生命週期

正常首頁沒有公開播放／暫停控制。`?debug=1`才顯示有標籤的調整項；`?view=portrait`提供獨立角色檢視，`?style=legacy`／`voxel`只供歷史比較，明確指定時才載入。

| 操作 | 行為 |
| --- | --- |
| `pose=1`／`pose=10` | 同一canonical靜止畫布，時間不影響結果 |
| `pose=4`／`pose=5` | 固定半閉／閉眼的美術與QA覆寫 |
| `wind=0` | 關閉髮束／耳環風動；正常眨眼時鐘仍獨立 |
| `t` | 固定0–120,000 ms完整經過時間，以便檢查不同風／眼相位 |
| `pause=1` | 明確暫停，保留靜止畫面 |
| `speed` | 播放倍率，不以掉幀調整速度 |
| `pixel` | 192／256／320邏輯網格比較 |

減少動態偏好提供穩定靜態肖像；隱藏分頁、離屏時停止繪製，回到畫面從原相位續播，不能按背景停留時間猛跳。更新、銷毀、strict-mode重掛及載入失敗都必須取消排程／監聽，不留下多條rAF鏈。

初始HTML與首次真正Canvas繪製前保留透明poster。素材載入有12秒逾時；失敗時使用獨立 `public/portrait-rest.png`（768²），同樣圓形、居中，並保留完整個人網站。OG分享圖另行合成，不取代透明備援。

## 5. 實作責任

| 模組 | 責任 |
| --- | --- |
| `portraitTimeline.ts` | 風與獨立眼瞼時鐘、可重現通道與時間取樣 |
| `portraitRig.ts`、`strandCurve.ts` | 固定區／髮根、局部髮束與眼罩、17段曲線及像素繪製 |
| `portraitPlayer.ts` | rAF、毫秒delta、可見性、素材／錯誤與資源清理 |
| `stageOptions.ts` | 有限值、時間範圍、網格、模式與debug輸入驗證 |
| profile展示元件與樣式 | 居中圓形、DPR尺寸、poster／Canvas一致；不管理風時鐘 |

預算列跨度、反向取樣及局部眼瞼／耳環像素清單減少逐幀重複計算。TypeScript將時鐘、渲染和展示分開；不為追求「優雅語言」遷移到需要額外runtime的技術，或用CSS整圖變換代替局部髮動。

## 6. 驗證與交付

本輪新證據集中 `artifacts/gentle-portrait/`，舊 `artifacts/pixel-world/`、`archive/evidence/portrait-v2/v4/v5/`保留當時結果。最新具體數字與限制以[持續微風](reference-wind.md)及落盤JSON為準，不將舊37／51／41通過項數或舊60 FPS量測移作新結果。

需檢查完整慢風週期、眨眼時仍有髮動、不同風相位的偶發眼事件、週期邊界的值及速度、固定人物區與髮根、二值alpha及固定調色盤。網站另核對四寬度、DPR清晰度、圓形與水平中軸、無JS／故障備援、鍵盤與未來帳號設定。密集截幀、GIF編碼、模擬刷新率及實際rAF／吞吐量分別記錄，不冒稱實體高刷螢幕已測。

從repo根目錄執行 `npm test`、`npm run typecheck`、`npm run build`、`npm run assets:check`、`npm run assets:verify`；工具與命令見[開發指南](development.md)。相關審查及CI通過後依擁有者授權自動合併main並核對Pages部署，保持source／reference與既有workflows不變。
