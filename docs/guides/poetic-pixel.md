# 高清圓形風景、細雪與飄落樱花

2026-11-06最後一輪精修：提高像素清晰度，保留原樱花／富士山／夕陽與無邊框圓形，讓明顯的粉色花瓣與更強細雪交錯飄過，首屏不再等待媒體或應用下載，並整理目前的倉庫結構。

## 畫面與來源

原ZIP及22份檔案保持原位、逐位元組不變；來源358×267，16個80ms錨點、1280ms循環。沿用48個離線來源過渡，形成64×20ms／50fps；沒有新增AI臉、母版姿態字段、runtime整圖形變或新的頭髮模擬。過渡是估計，不是新增原始拍攝資訊。

72色、原生細髮／樱花枝／山峰輪廓與完整來源座標保持。圓形仍最大534CSS像素、無描邊／陰影，沿用原cover裁切，沒有額外去背、減少原背景或圈外外景。圓形本身仍會遮住矩形四角，不宣稱完整矩形全部可見。

現在連續兩次使用只取既有顏色的Scale2x，將對角階梯細化到1432×1068；沒有模糊或新顏色。首幀最高2864×2136，動態按**實際圓形CSS直徑×DPR**選擇：

| 所需實體直徑 | Canvas | 用途 |
| --- | --- | --- |
| ≤1068 | 1432×1068 | 一般桌面DPR1／2與多數手機 |
| ≤1602 | 2148×1602 | 大圓形DPR3 |
| 其餘 | 2864×2136 | 大圓形DPR4，為最大上限 |

已知記憶體≤2GB時限制在第一檔。ResizeObserver與DPR事件觸發尺寸計算，沒有每幀讀取版面；調整畫布保留播放器、已解碼素材與原播放相位。原生64幀圖集仍約24.5MB解碼，不烘焙高清全圖集；重建只保留兩個4×影格及一個共用中間緩衝。放大不能還原來源沒有的原畫資訊。

圖集與首幀另以明確的共用72色索引儲存為PNG8，**只改儲存，不重新量化**：原生圖集3,560,856→1,395,624bytes（約省61%）、同一高清首幀300,674→148,704bytes、原16幀圖集1,103,913→419,082bytes。每份解碼RGB逐位元組相等；正常三份媒體合計由約5.26MB降為2.52MB（不表示每次預覽都下載完整）。見[無損與體積核對](../../artifacts/final-scene/lossless-size.json)。

## 細雪與花瓣

- 雪384片：遠160、中144、近80，48秒獨立周期；持續向下、帶柔和側風，點、微光及小結晶三種形狀。
- 粉色花瓣48片：遠20、中18、近10，96秒獨立周期；緩慢側落、輕擺、翻轉。中近景加大，讓缺口、圓肩與尖端可辨認，約8–17CSS像素，而不是只像粉色碎點。
- 花瓣使用四種粉色、16個角度與三種翻轉姿態的硬alpha小圖集，僅初始化生成一次，約70KB RGBA；繪製不旋轉整張場景、不模糊、不逐幀配置像素緩衝。
- 雪與花瓣都保留原表情區的柔和減量，不隨角色1.28秒重置。場景時鐘、位置、速度與回收均可重複驗證。

## 首屏與接手

初始HTML內自帶40片雪、12片粉色花瓣的輕量SVG／CSS入口層，從第一次HTML/CSS繪製便能動，**不依賴主程式、圖片動畫或影片解碼**。負初始相位讓粒子一開始已分布在圓內；減少動態／無JS時保持靜態與隱藏入口層。

小型muted／autoplay／playsinline MP4仍先行播放，改用baseline、無B幀及低延遲設定，由1,527,379縮至972,129bytes，約減少36%。React保留同一入口群組與video節點，恢復CSS動畫相位；高清畫面根據實際video.currentTime接手，隨即釋放影片。只有氣象層180ms淡出／淡入，人物不交叉淡入或形變。

隱藏／離屏停止影片、CSS入口及Canvas繪製；減少動態不讀影片／圖集，可用本機選擇開啟並撤銷。圖集或重建故障仍保留入口／預覽與網站內容，提供有限重試；準備過程任一構造失敗都關閉已取得的bitmap、清理快取和畫布。無JS仍保留高清首幀、導航、介紹、作品與聯絡。

入口動畫不等待媒體，並不表示網站可以不經網路下載HTML/CSS。實際首次繪製時間仍依訪客連線、裝置與瀏覽器而異。

## 目前結構

```text
src/features/poeticPixel/
  assets.ts                 匯出工具生成的型別化素材描述
  definition.ts             場景、高清首幀與預覽定義
  renderer.ts               素材準備、來源時鐘、重建與氣象組合
  bootstrap.ts              純入口標記、同節點影片／CSS接手
  presentation/             分辨率政策、事件hook、兩幀重建快取
  atmosphere/               雪、花瓣、硬alpha精靈及組合繪製
src/features/referenceScene/ 共用生命週期、圓形UI與來源時鐘
scripts/assets/              可重跑的來源動作／像素匯出與完整性驗證
scripts/qa/*final_scene.py   目前驗收、實際圓形截幀與獨立效能
public/assets/poetic-pixel/   目前衍生素材及來源清冊
artifacts/final-scene/       本輪證據；舊artifact不改寫
reference-projects/          不可變完整原工程
```

沒有再增加一套平行預設形象。舊`faithfulPixel`／`calmPortrait`／物理rig及舊證據為歷史；目前只有poeticPixel在正常首頁載入。AGENTS、README及npm場景命令均指向現在的實作。

## 重跑

```bash
npm run scene:derive
npm run scene:export
npm run build
npm run assets:check
npm run assets:verify
npm run preview -- --host 127.0.0.1 --port 5180
npm run scene:qa
npm run scene:capture
# 所有其他瀏覽器工作結束後，單獨量測：
npm run scene:measure
python3 scripts/qa/capture_final_scene.py --measure --dpr 4
```

`source:verify`核對原工程與既有來源基線；`scene:verify`核對目前場景。作者工具需要Pillow／NumPy／FFmpeg，瀏覽器QA需要Playwright／Chromium；CI資產核對僅用Python標準庫。

`?view=scene`隔離圓形；`?t=320&atmosphere=0`檢查原第4個動作錨點的純像素；`?t=40&atmosphere=0`檢查估計過渡；`?t=8000`檢查雪與花瓣；`?t=8000&petals=0`隔離雪；舊`snow=0`與`atmosphere=0`同樣關閉全部氣象。正常頁面沒有調試控制。

## 最後驗證

- 98項Node測試、strict TypeScript／production build及資產完整性通過。[來源證據](../../artifacts/final-scene/assets.json)核對22原檔、16原錨點的1,529,376個原生座標、64幀雜湊、最高2864×2136重建與型別化描述。
- [完整瀏覽器129項](../../artifacts/final-scene/site/checks.json)通過，包含22個原幀／過渡／邊界RGBA精確對照、純入口在主程式和影片都被阻斷時仍有實際像素變化、同節點相位接手、4／6／8倍尺寸、低記憶體上限與live resize不歸零／不重載、減少動態、隱藏／離屏、503預覽及重試、手機與無JS。模擬花瓣構造失敗時，取得1份bitmap亦關閉1份，重試恢復。
- 五個指定時刻在**實際可見圓形**中有107–274個原生粉色像素、13–28個可辨認群；表情區改變0.29–1.11%。[8000ms實際圓形](../../artifacts/final-scene/site/weather-time8000.png)可檢視粉色缺口花瓣及雪。
- [像素清晰度對照](../../artifacts/final-scene/style/dpr2-clarity.png)按DPR2邏輯像素生成；[實際CSS圓形動畫](../../artifacts/final-scene/preview/animation.mp4)為6.4秒／384張受控時間截圖，以60fps編碼，來源過渡仍50fps。動畫在無損PNG儲存優化前擷取，解碼像素及renderer／氣象程式與最後版本一致，見capture.json及lossless-size.json。
- [最後DPR1獨立量測](../../artifacts/final-scene/performance.json)：單一Chromium1440×1100，穩定2秒後12秒，無截圖／並行瀏覽器；約60.1次rAF／秒、50次來源換幀／秒，callback中位5.3ms／p95 6.6ms／最大13.2ms。入口動畫約151ms已可運作，影片首個解碼畫面約703ms、高清約1065ms，表示入口不等待媒體；這是本機條件，不是訪客網路保證。
- [最高DPR4量測](../../artifacts/final-scene/performance-dpr4.json)使用2864×2136畫布，約56.2次rAF／秒、48次來源換幀／秒，callback中位6.4ms／p95 9.3ms。最高檔資源開銷較高；舊RGB儲存測量保留在before-indexed-storage，不能混稱所有裝置都能固定60fps。各次量測無browsererror，未驗證實體螢幕FPS。
