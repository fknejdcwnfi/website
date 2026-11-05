# 原動畫逐幀像素畫

2026-11-06，擁有者再次上傳完整ZIP，明確要求「除了像素外和這個zip完全相同的效果」。這取代PR17的小幅後髮rig與獨立眨眼時鐘。角色、頭髮、眼睛、飾物及圓內景色都跟隨來源每一幀，不再重新模擬動作。

## 來源與動作

新上傳與倉庫的`reference-projects/fuji-wind/source-project.zip`逐位元組一致：4,247,267bytes，SHA256 `9ee2d35c4bbad5276b715de02ebf0e5e48e0e7372a3a26d42d790c9426c5760e`。22份檔案全部核對；README與render.py只讀作來源資料，不執行其程式或安裝指令。完整原ZIP、GIF及16份PNG維持原位與原內容，不重複加入同一ZIP。

原動畫是358×267、16幀、每幀80ms、1280ms無限循環。新版同順序同時長播放16份像素衍生幀，包含來源自身的眨眼、臉部小動作與15→0接縫。沒有新的12秒風場、24秒眨眼、AI母版姿態重定向、光流補幀、混色淡入或整圖變形。螢幕rAF可以約60Hz排程，畫面內容仍以來源12.5fps更新；不能把重複繪製稱為新增的真實動作影格。

## 像素轉製與展示

只減少顏色的測試仍像動漫原圖，已淘汰。現在使用全序列共用的37色色板、銳利的2×2代表色色塊，以及保留原生細像素的眼睛／嘴／藍色飾物。37色包含5份來源的深藍、藍寶石中間色、亮藍與白色高光，避免全域色板使眼睛與飾物褪色。色板與色彩映射只建立一次，沒有每幀重新學習、模糊平均、抖色噪點或生成新臉。每個色塊的顏色取自它原來的2×2來源鄰域；這是有限的像素風格化，不宣稱轉換後RGB或輪廓每一個像素等於原圖。來源座標、畫面比例及時間對應保持，沒有把一張新母版拉扯成來源姿態。

衍生圖集仍為358×267原生座標。Canvas用nearest整數2倍輸出716×534，關閉平滑，CSS使用pixelated；放大不冒稱新增原畫解析度。既有最大534CSS像素的無邊框圓形保留，完整來源場景保存在原生圖集內，圓形展示維持原來的cover裁切；沒有圈外外景／雪層。

正常首頁只有完整個人網站與持續播放的圓形，沒有調試控制。初始HTML、poster及減少動態使用同一像素首幀。減少動態不載入圖集，訪客可選擇開啟並撤銷；隱藏與離屏暫停、恢復保相位、失敗後保留靜態內容與有限重試。

## 結構與重跑

| 路徑 | 責任 |
| --- | --- |
| `reference-projects/fuji-wind/` | 不可變完整ZIP、原始GIF／PNG及來源清冊 |
| `scripts/assets/export_faithful_pixel_scene.py` | 離線共用色板、像素色塊與來源對應匯出 |
| `public/assets/faithful-pixel/` | 新預設圖集、高清首幀、manifest |
| `src/features/faithfulPixel/` | 生成描述、場景定義、只切換原幀的renderer |
| `src/features/referenceScene/` | 共用播放器生命週期、圓形展示及DPR對齊 |
| `scripts/assets/verify_faithful_pixel_scene.py` | CI標準庫獨立PNG解碼、來源與鄰域驗證 |
| `scripts/qa/verify_faithful_scene.py` | production整站、每幀Canvas與生命週期檢查 |
| `artifacts/faithful-pixel/` | 本輪來源核對、畫面、原動作預覽與效能 |

```bash
python3 scripts/assets/export_faithful_pixel_scene.py
npm run build
npm run assets:verify
npm run preview -- --host 127.0.0.1 --port 5180
python3 scripts/qa/verify_faithful_scene.py --url http://127.0.0.1:5180/website/
python3 scripts/qa/capture_faithful_scene.py --encode-preview
# 其它瀏覽器工作結束後獨立量測：
python3 scripts/qa/capture_faithful_scene.py --measure
```

`?view=scene`隔離同一圓形；`?t=320`固定來源第4幀；`?t=-1`檢查最後一幀；`?t=1280`回到第0幀。舊motion參數不會啟用已拒絕的整圖重定向或估計補幀。歷史calmPortrait與referenceScene舊美術素材保留，但不在現在首頁的請求鏈中。

這是保留原片動作的Minecraft-inspired **2D像素畫**，不是Minecraft遊戲內的3D模型。畫風由離線衍生圖集決定，runtime只有來源時鐘與直接繪圖，修改畫風不應重新發明頭髮動作。

## 本輪證據

- 83項Node單元、strict TypeScript、production build、資產檢查通過。新增來源驗證已接入既有CI，毋須Pillow／NumPy即可執行。
- [來源核對](../../artifacts/faithful-pixel/assets.json)：新ZIP及22原檔逐位元組一致；16幀的1,529,376個原生座標全部限制在自身2×2色彩鄰域，細節保護、衍生雜湊、高清首幀及編譯描述一致。
- [production網站82項](../../artifacts/faithful-pixel/site/checks.json)通過；16個原幀與6個邊界取樣的Canvas均零差，實際像素在觀察開始後40.9ms改變（不是頁面載入延遲）；包含偏好選擇、離屏／隱藏、HTTP503／繪製故障恢復、手機及無JS。
- [四個來源姿態對照](../../artifacts/faithful-pixel/style/source-comparison.png)與[實際CSS圓形預覽](../../artifacts/faithful-pixel/preview/animation.mp4)：534×534，四輪共5.12秒，來源每幀80ms；50fps影片只重複既有影格，沒有插值。
- [獨立production效能](../../artifacts/faithful-pixel/performance.json)：單一Chromium1440×1100／DPR1，2秒穩定後12秒無截圖取樣；720次rAF約60次／秒，150次來源換幀約12.5次／秒，callback中位0.1ms／p95 0.2ms／最大0.7ms，無browsererror。不是實體使用者螢幕FPS量測。

首頁兩份PNG合計609,488bytes。效能與逐幀一致性可以重跑；像素風格及自然觀感仍需以實際畫面判斷，不把測試通過等同擁有者已接受美術。
