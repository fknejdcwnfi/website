# 高清圓形風景與連貫飄雪

2026-11-06，擁有者要求在現有像素動畫上提高清晰度／解析度，保留樱花、富士山等詩意背景及圓形展示，加強雪花，進站即有變化，動作更連貫。這取代PR18的粗2×2細節及只播放16原幀的預設；來源人物、原動作及不可變工程仍是權威。

## 畫面與原工程

現在預設位於`src/features/poeticPixel/`。保留全358×267來源座標與原背景，不另外裁切或去背；顯示維持最大534CSS像素、無描邊無陰影圓形，沿用原有cover裁切，沒有圈外外景。圓形本身仍會遮住矩形四角，不能稱為整張矩形無裁切展示。

共用72色由原16幀的實際顏色選出，包含固定的藍眼／藍寶石及高光。小面積材質仍用2×2代表色色塊，對比至少50的原生1px輪廓及眼、嘴、珠寶細節則保留，讓細髮、樱花枝與山峰不被大色塊抹平。沒有每幀重新選色、模糊、抖色或新生成的臉。

Canvas與靜態首幀從716×534提升到1432×1068。先用只取既有顏色的Scale2x細化階梯輪廓到716×534，再nearest2輸出；畫布／CSS均禁用平滑。這改善細節保留及高DPR呈現，不能恢復原358×267以外的原畫資訊。

## 原動作、過渡幀與雪

原工程完整22份檔案及ZIP維持原位、逐位元組不變。來源仍是16×80ms、1280ms循環。離線只在**相鄰來源影格**之間估計48份過渡，形成64×20ms／50fps；原始PNG複製到每4幀的錨點，像素轉製後的所有16個錨點仍與同一原幀獨立轉製相等。眼睛使用單一來源眼區及來源推導的頭部平移，不混合兩種眨眼狀態。

過渡幀由FFmpeg MCI估計，不是新增原始拍攝資訊；細髮與遮擋交界仍可能有估計誤差。沒有新母版姿態重定向、AI臉輪播、runtime整圖位移場或另一套頭髮物理。`?motion=original`可明確檢查原16幀，正常頁面不顯示調試控制。

雪在同一圓形內繪製：遠128、中112、近48，共288片，點、微光與小結晶三種形狀。初始時間已有完整雪場，48秒獨立循環，持續向下並帶緩慢側風；不隨角色1.28秒重置。臉部採柔和減量，保留眼神和飾物的可讀性。雪隨可見rAF更新，不受50fps來源換幀限制；沒有每幀隨機生成或物件配置。

## 進站播放與效能

初始HTML內的小型muted／autoplay／playsinline MP4由parser腳本啟動，毋須等待React或高清圖集。React保留並接回**同一個video節點**，圖集解碼及首／末幀重建在預覽下完成。第一個實際高清畫面讀取video.currentTime接手，之後釋放影片來源，避免重複下載與播放。

圖集保持原生358×267、64幀，2864×2136解碼約24.5MB；沒有烘焙64份高清幀造成約98MB的單圖解碼。runtime只保留4份Scale2x輸出緩衝及一份中間畫布。影片是可逐段解碼的faststart格式，首屏開始時間仍受實際網路與瀏覽器自動播放能力影響。

減少動態只讀高清靜態首幀，不請求影片／圖集，可明確開啟並撤銷本機選擇。隱藏、離屏停止繪製並保留相位。圖集故障但預覽正常時持續播放預覽，提供有限自動重試及手動重試；JS不可用時仍有清晰首幀、導覽、介紹、作品和聯絡。

## 結構與重跑

| 路徑 | 責任 |
| --- | --- |
| `reference-projects/fuji-wind/` | 唯讀完整ZIP、GIF、16份來源PNG與來源清冊 |
| `scripts/assets/derive_poetic_motion.py` | 離線50fps來源估計、原錨點及動作來源證據 |
| `scripts/assets/export_poetic_pixel_scene.py` | 72色、輪廓／材質像素、圖集、高清首幀及預覽 |
| `public/assets/poetic-pixel/` | 新預設素材與可重跑的來源清冊 |
| `src/features/poeticPixel/` | 定義、生成描述、原幀播放、預覽接手及獨立雪場 |
| `src/features/referenceScene/` | 共用生命週期、圓形UI、DPR與像素重建 |
| `scripts/assets/verify_poetic_pixel_scene.py` | CI標準庫獨立PNG、來源鄰域、高清及描述核對 |
| `scripts/qa/verify_poetic_scene.py` | production逐幀、雪、首屏、接手與備援 |
| `artifacts/poetic-pixel/` | 當輪畫面、動畫、來源及效能證據 |

```bash
python3 scripts/assets/derive_poetic_motion.py
python3 scripts/assets/export_poetic_pixel_scene.py
npm run build
npm run assets:check
npm run assets:verify
npm run preview -- --host 127.0.0.1 --port 5180
python3 scripts/qa/verify_poetic_scene.py
python3 scripts/qa/capture_poetic_scene.py
# 所有其他瀏覽器工作結束後獨立量測：
python3 scripts/qa/capture_poetic_scene.py --measure
```

`?view=scene`隔離同一圓形；`?t=40&snow=0`檢查第2份估計過渡而不疊雪；`?t=320&snow=0`檢查原第4幀的高清像素；`?motion=original&t=320&snow=0`檢查原16幀時鐘。正常預設不載入舊faithful／calm或被拒絕的AI姿態字段。

## 本輪驗證

- 88項Node單元（含雪場初始分布、向下軌跡、回收／48秒接縫、獨立時鐘、臉部可讀性與繪製狀態）、strict TypeScript、production build及資產檢查通過。
- [來源與高清核對](../../artifacts/poetic-pixel/assets.json)：22個原檔、16個原錨點的1,529,376個原生像素鄰域、來源色板、64幀雜湊及1432×1068重建均通過。
- [production瀏覽器87項](../../artifacts/poetic-pixel/site/checks.json)通過；26個原幀／估計過渡／邊界時刻與高清預期RGBA完全相同。module阻擋、圖集持續待載3秒時預覽的**實際RGB**仍變化，同一parser節點保留，首個高清畫面按影片實際相位接手。包括同一來源幀內的獨立雪、表情可讀性、影片釋放、減少動態／本機選擇、離屏／隱藏、503故障預覽與重試、手機及無JS。
- [清晰度對照](../../artifacts/poetic-pixel/style/clarity-comparison.png)與[實際圓形動態](../../artifacts/poetic-pixel/preview/animation.mp4)：534×534CSS，6.4秒／384張受控時間截圖，以60fps編碼；動作為50fps估計序列、雪隨截圖時鐘更新，不冒稱量測實體螢幕FPS。
- [獨立production效能](../../artifacts/poetic-pixel/performance.json)：單一Chromium1440×1100／DPR1、穩定2秒後獨占12秒，無截圖／並行瀏覽器；720次rAF約60／秒、599次來源換幀約49.9／秒，callback中位1.8ms／p95 2.3ms／最大4ms，無browsererror。當次本機預覽首個已解碼畫面約626ms、高清可用約885ms；不是一般訪客的網路保證。
