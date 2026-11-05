# 原 GIF 驅動的原生像素圓形場景（前一版）

> 最新整體Minecraft美術、圈外完整背景及首屏動態見[目前重構指南](minecraft-scenic-rebuild.md)。以下保留PR #15階段的來源像素驗證，不是新美術契約。

2026-11-05最新要求：圓形、邊框不明顯，修正馬賽克感、提高連貫度及清晰度，並整理工程結構。本頁取代上一版全幅矩形展示和160×120／80色的轉製設定；來源動作仍由使用者完整GIF工程決定。

## 完整來源與不可變資料

`reference-projects/fuji-wind/source-project.zip`完整保存上傳ZIP；`original/`的22份解包檔與ZIP成員逐位元組一致，`provenance.json`記錄CRC／SHA來源。原GIF為358×267、16幀、每幀80ms、周期1280ms、loop=0。16張PNG與GIF解碼RGB一致，全部原影格合計只有255種RGB。

工程是從GIF整理的影格資料，不含原始模型或獨立髮束圖層。附帶README和render.py作為資料保留，不執行它們，也不遵循上傳文件中的安裝指令。`assets/source/**`、`docs/reference/**`和這份上傳原工程均不可改寫。

## 清晰度與展示

上一版先縮為160×120再放大，確實丟失了眼睛、細髮、耳鏈和背景細節。本版完全移除降採樣和4:3比例修正：從讀圖、圖集tile、canonical到Canvas均為原生358×267。原16錨幀保留全部255種源色，與原PNG的解碼RGBA逐像素0差；PNG索引編碼也無損。中間樣本統一映射至同一調色盤，沒有dither、Canvas平滑、CSS blur或放大後銳化。

呈現是Minecraft-inspired二維像素格及清晰nearest顯示，保留來源的角色與場景風格；沒有將GIF冒稱官方Minecraft美術或新增手工重繪的紋理。

展示層是無描邊、無陰影的圓，最大直徑534CSS像素，`object-fit: cover`只裁切顯示窗口，原圖／圖集不裁切。桌面534=267源行×2；按viewport／DPR選整數物理像素倍率並對齊源圖起點，包括奇數倍率下91列寬差造成的半像素裁切。手機若整數倍率佔可用寬度不足82%，則優先保持可讀尺寸，這種情況不宣稱每個源像素都等寬。圓邊本身允許瀏覽器抗鋸齒。

尺寸測量只由ResizeObserver、resize、DPR媒體變化及字體完成觸發；不在動畫每幀讀layout。方形空間預留防止掛載校正推動正文，載入／錯誤／減少動態說明留在圓外。無JS後備也採原生首幀和相同無邊圓形。

## 動作與更新率

原GIF的髮束、眼睛、頭肩、耳環與背景都依同一1280ms源時鐘前進，不再使用舊肖像的12秒風／24秒獨立眨眼。`?motion=original`提供16×80ms源節奏對照；預設為160×8ms（125樣本／秒）運動補償序列，比前版128×10ms提供更密的中間時刻。每第10張強制為原PNG，原80ms錨點完全保留。不能將125估計樣本／秒寫成原影片125fps或實測顯示器FPS。

離線FFmpeg MCI使用三輪來源的中間輪，避免缺乏循環前後文。眼區只搬移單一原眼形，位置根據原圖鼻線的小範圍配準，外4px皮膚羽化；不混兩套眼／睫毛輪廓，原7／8閉眼狀態及80ms時序保留。原眨眼狀態切換、細髮／雪點／遮擋及原15→0跳變仍受來源限制，並非完整空氣動力學或逐根毛髮模擬。

rAF不鎖60Hz、不逐callback累加固定16ms；可見時直接按真實經過時間取源樣本，短暫忙碌後追上時鐘。144Hz模擬callback只驗證不被60Hz節流，不能代替實體高刷螢幕量測。`?view=scene`隔離展示；`?t=560`固定源時刻檢查。

## 工程邊界

```text
reference-projects/fuji-wind/       不可變ZIP／22原檔／來源清冊
scripts/assets/derive_reference_motion.py   離線運動估計、原錨點驗證
src/authoring/referenceScene/sourcePixels.ts 離線原生像素／調色盤／packing
scripts/assets/export_source_scene.py       呼叫authoring、無損索引PNG與來源hash
public/assets/reference-scene/     網站所需canonical／source與smooth圖集／manifest
src/features/referenceScene/
  sourceTiming.ts                 原GIF／派生樣本時鐘與輸入驗證
  loadScene.ts, createSourceRenderer.ts     有界載入、解碼前幾何／時序校驗
  ScenePlayer.ts                  rAF、取消、可見性與偏好生命週期
  sceneViewport.ts, useSceneViewport.ts    純尺寸計算及事件驅動觀察
  ReferenceScene.tsx, referenceScene.css   圓形展示、後備及必要說明
scripts/qa/                       真實Canvas／CSS／生命週期／效能驗證
artifacts/crisp-circle/            本輪證據；不覆蓋前版reference-scene證據
```

離線authoring與runtime分開；新首頁不import authoring或下載ZIP／原影格，舊portrait／voxel／legacy只在明確歷史路由lazy載入。保留strict TypeScript、React、Canvas 2D，沒有新增runtime依賴或後端。

只啟用動態才載入圖集；減少動態只載原生首幀，可明確啟用並恢復跟隨系統。本機選擇、載入逾時、有限重試、online恢復、錯誤後備、隱藏／離屏保相位和generation取消防競態保留。個人介紹、搜尋、真實作品和聯絡不依賴動畫成功。

## 重跑與驗證

離線工具另需本機FFmpeg、NumPy、Pillow、Playwright和Chromium；正常網站build無需它們，不自動安裝上傳工程依賴。

```bash
npm run dev -- --host 127.0.0.1 --port 5198
python3 scripts/assets/derive_reference_motion.py
python3 scripts/assets/export_source_scene.py --url http://127.0.0.1:5198/
python3 scripts/assets/export_source_scene.py --url http://127.0.0.1:5198/ --input-manifest work/reference-scene/interpolated/timing.json --output-prefix smooth --palette-manifest public/assets/reference-scene/source-manifest.json
npm run build
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_source_scene_assets.py --output artifacts/crisp-circle/source-assets.json
python3 scripts/qa/verify_reference_scene_player.py --url http://127.0.0.1:5198/ --output artifacts/crisp-circle/player-lifecycle.json
python3 scripts/qa/verify_source_scene_clock.py --url http://127.0.0.1:5198/ --output artifacts/crisp-circle/source-clock.json
npm run preview -- --host 127.0.0.1 --port 5180
python3 scripts/qa/verify_reference_site.py --url http://127.0.0.1:5180/website/ --output artifacts/crisp-circle/site
python3 scripts/qa/capture_reference_scene.py --url http://127.0.0.1:5180/website/ --output artifacts/crisp-circle/preview
# 完成所有截圖和其它瀏覽器工作後獨立執行：
python3 scripts/qa/measure_reference_scene.py --url http://127.0.0.1:5180/website/ --output artifacts/crisp-circle/performance.json
```

70項Node單元、strict TypeScript／build及來源hash檢查通過。[素材68項](../../artifacts/crisp-circle/source-assets.json)包含16個原PNG精確保留與16個smooth錨點0差；[源時鐘4項](../../artifacts/crisp-circle/source-clock.json)及[生命週期15項](../../artifacts/crisp-circle/player-lifecycle.json)包含144Hz模擬回調、可見時掉幀追時鐘、減少動態、隱藏／離屏、取消與失敗恢復。

本版原生smooth圖集5,508,445 bytes、canonical54,123 bytes，圖集RGBA解碼約58.3MiB，比先前低解析圖集更大；以清晰度為本輪優先，無執行時物理求解或逐像素重算。圖片URL含內容hash防止新舊圖集混用，無JS首幀由每次部署原子更新。實際傳輸、記憶體與顯示率仍取決於瀏覽器及裝置。

[整站47項](../../artifacts/crisp-circle/site/checks.json)通過；534px圓內218,964個實際CSS像素對native nearest預期0差，包含手機、實際動態、可見性、失敗恢復和無JS。[預覽](../../artifacts/crisp-circle/preview/animation.mp4)為真實圓形CSS截圖，534×534、120fps編碼、768張／6.4秒，另保留16張未裁native anchors，未混用rawCanvas方形影片當圓形證據。

[Production性能](../../artifacts/crisp-circle/performance.json)：同一原生Chromium單頁1440×1100／DPR1，無節流，穩定2.5秒後量12.8秒（10周期），期間沒有截圖或並行瀏覽器；768次繪製、60.00／秒，callback p95 0.2ms／max0.7ms，0長任務／Worker／JS及HTTP錯誤。本地ready約699ms，不能外推為慢網路或實體高刷顯示器保證。
