# 高清圓形風景、細雪與飄落樱花

2026-11-06再精修：延續無邊框圓形、樱花／富士山／夕陽及即時入口，增加原畫顏色層次、細雪與花瓣，細分花瓣側轉並減少換幀像素讀回。保留唯一現行feature，沒有重啟已被拒絕的整圖形變。

## 畫面與來源

原ZIP及22份檔案保持原位、逐位元組不變；來源358×267，16個80ms錨點、1280ms循環。沿用48個離線來源過渡，形成64×20ms／50fps；沒有新增AI臉、母版姿態字段、runtime整圖形變或新的頭髮模擬。過渡是估計，不是新增原始拍攝資訊。

跨全部原幀固定96色：保留原72色，加入24種原工程RGB，不按單幀重新量化；原生細髮／樱花枝／山峰輪廓與完整來源座標保持。[局部對照](../../artifacts/scenic-refinement/style/background-closeups.png)與[534px圓形離線色彩對照](../../artifacts/scenic-refinement/style/circles.png)記錄72／88／96色的細微差別；全16幀可見區對來源RGB均方差減少3.71%，樱花區5.28%，不是新增來源解析度或美感分數。

圓形仍最大534CSS像素、無描邊／陰影，沿用原cover裁切，沒有額外去背、減少原背景或圈外外景。圓形本身仍會遮住矩形四角，不宣稱完整矩形全部可見。

現在連續兩次使用只取既有顏色的Scale2x，將對角階梯細化到1432×1068；沒有模糊或新顏色。首幀最高2864×2136，動態按**實際圓形CSS直徑×DPR**選擇：

| 所需實體直徑 | Canvas | 用途 |
| --- | --- | --- |
| ≤1068 | 1432×1068 | 一般桌面DPR1／2與多數手機 |
| ≤1602 | 2148×1602 | 大圓形DPR3 |
| 其餘 | 2864×2136 | 大圓形DPR4，為最大上限 |

已知記憶體≤2GB時限制在第一檔。ResizeObserver與DPR事件觸發尺寸計算，沒有每幀讀取版面；調整畫布保留播放器、素材與原播放相位。原生64幀圖集約24.5MB RGBA，不烘焙高清全圖集；重建只保留兩個4×影格及一個共用中間緩衝。放大不能還原來源沒有的原畫資訊。

圖集與首幀以明確共用96色索引儲存為PNG8，不在儲存時重新量化。原生圖集1,641,539bytes、高清首幀160,986bytes、原16幀圖集491,665bytes；正常三份媒體含預覽共2,770,028bytes。新增色彩使主圖集比前72色版增大17.62%，並非再一次無損減檔；舊版61%縮減紀錄保留在舊證據，不作本版體積宣稱。

準備時受8,388,608像素上限保護，一次讀取原生圖集，隨即關閉bitmap、移除image來源、清空scratch畫布，再暖機兩幀輸出。第一遍Scale2x直接讀同一子區域stride並在幀邊界夾取鄰居；第二遍規則不變。換幀不再drawImage／getImageData原生小圖，也不再配置短命ImageData。獨立64幀比對完全相同；新增單元檢查包含243種鄰域、透明色、圖集邊界、快取及銷毀。一次全圖讀回會增加短暫準備開銷與記憶體，故仍讓入口播放，不宣稱啟動或所有裝置FPS必然更快。

## 細雪與花瓣

- 雪448片：遠192、中160、近96，48秒獨立周期；持續向下、帶柔和側風，點、微光及小結晶三種形狀。
- 粉色花瓣60片：遠24、中22、近14，96秒獨立周期；緩慢側落、輕擺、翻轉。保留中近景約8–17CSS像素大小、缺口、圓肩與尖端。
- 花瓣使用四種粉色、32個角度與5種翻轉姿態的硬alpha小圖集，僅初始化生成一次，352×165／232,320bytes RGBA；繪製不旋轉整張場景、不模糊、不逐幀配置像素緩衝。側轉總投影面積逐級增加，避免一次大跳。
- 雪與花瓣都保留原表情區的柔和減量，不隨角色1.28秒重置。場景時鐘、位置、速度與回收均可重複驗證。

## 首屏與接手

初始HTML內自帶40片雪、12片粉色花瓣的輕量SVG／CSS入口層，從第一次HTML/CSS繪製便能動，**不依賴主程式、圖片動畫或影片解碼**。負初始相位讓粒子一開始已分布在圓內；減少動態／無JS時保持靜態與隱藏入口層。

小型muted／autoplay／playsinline MP4仍先行播放，baseline、無B幀及低延遲設定，更新色板後967,503bytes。React保留同一入口群組與video節點，恢復CSS動畫相位；高清畫面根據實際video.currentTime接手，隨即釋放影片。只有氣象層180ms淡出／淡入，人物不交叉淡入或形變。12秒主程式仍未就緒時，提示仍可瀏覽內容與場景預覽，避免把仍在播放的入口說成靜態。

隱藏／離屏停止影片、CSS入口及Canvas繪製；減少動態不讀影片／圖集，可用本機選擇開啟並撤銷。圖集或重建故障仍保留入口／預覽與網站內容，提供有限重試；準備過程任一構造失敗都關閉已取得的bitmap、清理快取和畫布。無JS仍保留高清首幀、導航、介紹、作品與聯絡。

入口動畫不等待媒體，並不表示網站可以不經網路下載HTML/CSS。實際首次繪製時間仍依訪客連線、裝置與瀏覽器而異。

## 目前結構

```text
src/features/poeticPixel/
  assets.ts                 匯出工具生成的型別化素材描述
  definition.ts             場景、高清首幀與預覽定義
  renderer.ts               素材準備、來源時鐘、重建與氣象組合
  bootstrap.ts              純入口標記、同節點影片／CSS接手
  presentation/             一次圖集讀回、兩幀重建、分辨率政策／hook
  atmosphere/               雪、花瓣、硬alpha精靈及組合繪製
src/features/referenceScene/ 共用生命週期、圓形UI與來源時鐘
scripts/assets/              可重跑的來源動作／像素匯出與完整性驗證
scripts/qa/*final_scene.py   目前驗收、實際圓形截幀與獨立效能
public/assets/poetic-pixel/   目前衍生素材及來源清冊
artifacts/scenic-refinement/ 本輪證據；舊artifact不改寫
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

- 104項Node測試、strict TypeScript／production build及資產完整性通過。[來源證據](../../artifacts/scenic-refinement/assets.json)核對22原檔、16原錨點的1,529,376個原生座標、64幀雜湊、96色、最高2864×2136重建與型別化描述。
- [完整瀏覽器134項](../../artifacts/scenic-refinement/site/checks.json)通過，包含22個原幀／過渡／邊界RGBA精確對照、純入口在主程式和影片都被阻斷時仍有實際像素變化、同節點相位接手、4／6／8倍尺寸、低記憶體上限與live resize不歸零／不重載、減少動態、隱藏／離屏、503預覽及重試、手機與無JS。新增全圖讀回故障／花瓣構造故障後的bitmap釋放、scratch清空與重試恢復。
- 實際正常換幀觀察到16個來源幀，只在準備時讀回一次2864×2136原生圖集；觀察期間沒有額外getImageData。
- 五個指定時刻在**實際可見圓形**中有147–302個原生粉色像素、20–31個可辨認群；表情區改變0.37–1.10%。[8000ms實際圓形](../../artifacts/scenic-refinement/site/weather-time8000.png)可檢視粉色缺口花瓣及雪。
- [本版實際CSS圓形動畫](../../artifacts/scenic-refinement/preview/animation.mp4)為6.4秒／384張受控時間截圖，以60fps編碼；來源過渡仍50fps，花瓣與雪使用獨立時鐘，不把影片編碼率稱作來源幀率。
- [DPR1獨立量測](../../artifacts/scenic-refinement/performance.json)：單一Chromium1440×1100，穩定2秒後12秒，無截圖／並行瀏覽器；約59.98次rAF／秒、49.98次來源換幀／秒，callback中位4.8ms／p95 6.2ms／最大17.2ms。入口動畫被觀察到可運作約727ms、影片首解碼約945ms、高清約1301ms；本機條件不能作訪客網路的時間保證。
- [最高DPR4量測](../../artifacts/scenic-refinement/performance-dpr4.json)使用2864×2136畫布，約59.91次rAF／秒、49.83次來源換幀／秒，callback中位5.1ms／p95 6.2ms／最大28.1ms。入口約541ms、影片約1215ms、高清約1404ms。兩次量測無browsererror，仍有單次長callback，未驗證實體螢幕FPS，也不保證所有裝置固定60fps。
