# Minecraft像素美術、圓外全景與即時動態（已撤回預設）

> 使用者在2026-11-06拒絕本版整圖扭曲及外背景。現在預設見[穩定圓形](calm-circle.md)。本頁與scenic-snow證據只保存歷史，不能恢復為首頁。

2026-11-05，擁有者要求進一步提高清晰度、恢復樱花與富士山等詩意背景、增強飄雪、進站即開始動態，並明確要求「整個畫面重構為Minecraft像素風，動作和幀率保持」。展示選擇已確認：**保留圓形頭像，景色延展在圓外**。本頁是最新契約，取代前版僅358×267原GIF／255色加Scale2x仍為動畫畫風的預設。

## 真正改變美術

`assets/generated/minecraft-style/style-master.png`是單一新繪1452×1083像素美術母版：階梯髮束與輪廓、方塊材質、明確藍色像素眼形、藍寶石耳墜與項鏈。它保留原角色構圖及辨識特徵，但不是原GIF像素完全相同的圖片。`closed-eye-master.png`只提供兩塊局部眼瞼，未採用其中其它臉、頭髮或背景像素；不獨立生成每幀新面孔。

背景`assets/generated/fuji-scenery/style-scenery.png`是1536×1024的新繪Minecraft-inspired景色延展，包含階梯方塊富士山、方塊樱花和木枝、雪層松林、湖面及夕陽；沒有第二個人物。母版及每次提示詞／來源／SHA保留，舊景色候選明確分開。它補繪原GIF未提供的景色，不冒稱恢復被人物遮擋的原始細節。

製作時用同一256色調色盤轉成358×267邏輯像素，再以Scale2x邊緣規則重建716×534輸出，停用Canvas平滑並用nearest展示。Scale2x只使用既有源色，不能單獨稱為Minecraft美術或恢復細節；本次風格來自新繪的角色與景色。所有源GIF／ZIP／PNG依舊不可變，原source／smooth圖集留作來源與歷史驗證，不由新首頁下載。

## 同一來源節奏、受約束的動作重定向

原GIF16×80ms／1280ms周期不變，新MC圖集仍為16個錨時刻和160×8ms估計樣本（125／秒）。單母版通過由原16姿態估計的低頻位移場重定向：多尺度Lucas–Kanade觀測、鼻線／柔性臉區約束、平滑速度及六次scaling-and-squaring，所有16字段和160線性中間樣本的最小Jacobian為0.16002464，無翻折。安全位移在圓形內仍可見，並非僅裁切外數值較大。字段保存在`assets/generated/minecraft-style/motion-fields/`，可逐檔驗證。

眨眼只在母版眼區做像素眼瞼wipe，6→7錨點閉合、7／8完全閉眼、8→9重新睜開；與來源同一1280ms時鐘，不加另一套隨機眨眼。臉部其它區域來自同一母版；中間樣本不是兩張整臉的cross-fade。

**保持的是源錨時刻、周期與125樣本節奏；不是聲稱新美術RGB或每根髮絲的幾何都等於原GIF。** 新材質、遮擋和隱藏髮層有限，位移場及中間形變均是估計。固定粗網格、逐幀隨機材質、液態高頻光流、暖色硬mask孔洞的原型均未用於正式路徑。

## 圓形、完整背景與飄雪

景色以完整3:2圖片自然比例顯示，`object-fit: contain`，沒有裁掉左富士山或右樱花／夕陽。圓形人物居中稍向下，無描邊／陰影，最大534CSS像素；手機採舞台寬約72%並預留少量底部溢出空間，使左右景色可見、caption不重疊。只在人物viewport上圓裁切。

天氣有獨立216片遠／中／近景雪，32秒長周期，從首個掛載幀即存在，持續向下、受橫風及不同錯相擺動。像素雪片亮度和速度分層，眼臉區降低遮擋。天氣繪於獨立透明Canvas，不能污染人物錨幀；不等待圖集、不在每幀讀layout。系統減少動態、隱藏／離屏與固定QA時刻均有靜止／保相位行為。

## 首屏不等待完整圖集

初始HTML包含無src的boot video，頁內短腳本根據系統偏好和本機明確選擇啟動同源progressive MP4。`moov`在`mdat`之前，首段可播放而不需整個圖集；影片716×534、125fps、160張／1280ms，H264 CRF26是過渡媒體，與無損PNG分開記錄。

React啟動前保留同一video DOM節點，重新附到圓形內，不換src或重置播放時刻。新Canvas真正開始可見動態前，僅一次採用video.currentTime作源相位；接手後暫停影片並釋放decoder/source。不重新fetch一份已隨bundle編譯的完整manifest，圖集直接根據受驗證descriptor低優先載入。景色亦不阻塞首段人物播放；天氣不依賴任何媒體。

減少動態不下載video或圖集，只畫HD首幀，保留明確啟用及恢復跟隨系統。載入失敗時已播放的影片可繼續，另保留重試、有限自動恢復及完整網站內容。網路請求／解碼有實際耗時，不能保證零毫秒；應用阻塞主JS與圖集的實頁測試證明先動，不能只引用本地ready數字。

## 工程結構與重跑

```text
reference-projects/fuji-wind/             不可變完整上傳工程及來源清冊
assets/generated/minecraft-style/        單母版、局部眼瞼、來源及16位移字段
assets/generated/fuji-scenery/            圓外完整Minecraft景色與兩版來源
scripts/assets/retarget_pixel_motion.py  離線估計與無翻折約束
scripts/assets/export_scene_presentation.py  固定調色、眼瞼、PNG／MP4及描述檔
scripts/assets/scale_pixel_art.py         離線Scale2x，與runtime同規則
src/features/referenceScene/
  pixelAssets.ts, presentationAssets.ts  生成的版本化小描述檔
  createSourceRenderer.ts, pixelArtScale.ts  native圖集／有界四幀HD緩存
  ScenePlayer.ts, bootstrapVideo.ts      源時鐘、同video節點與相位接手
  ReferenceScene.tsx, weather/           圓外全景、首屏播放與獨立天氣
public/assets/reference-scene/            網站素材，不包含原工程執行碼
artifacts/scenic-snow/                    當輪真實畫面與測量；舊證據不替代本輪
```

正常build僅需Node24；離線作者工具另需Pillow／NumPy／SciPy／FFmpeg。不上傳工程的安裝腳本，不新增網站runtime依賴。

```bash
python3 scripts/assets/retarget_pixel_motion.py --frames 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15 --regularize 8 --output assets/generated/minecraft-style/motion-fields
python3 scripts/assets/export_scene_presentation.py --flows assets/generated/minecraft-style/motion-fields
npm run build
npm run assets:check
npm run assets:verify
npm run dev -- --host 127.0.0.1 --port 5198
python3 scripts/qa/verify_reference_scene_player.py --url http://127.0.0.1:5198/ --output artifacts/scenic-snow/player-lifecycle.json
python3 scripts/qa/verify_source_scene_clock.py --url http://127.0.0.1:5198/ --output artifacts/scenic-snow/source-clock.json
npm run preview -- --host 127.0.0.1 --port 5180
python3 scripts/qa/verify_reference_site.py --url http://127.0.0.1:5180/website/ --output artifacts/scenic-snow/site
python3 scripts/qa/verify_scenic_scene.py --url http://127.0.0.1:5180/website/ --output artifacts/scenic-snow/progressive-start.json
python3 scripts/qa/capture_reference_scene.py --url http://127.0.0.1:5180/website/ --output artifacts/scenic-snow/preview
# 所有其它browser和截圖結束後獨立量測：
python3 scripts/qa/measure_reference_scene.py --url http://127.0.0.1:5180/website/ --output artifacts/scenic-snow/performance.json
```

## 本輪驗證與實測

- 80項Node單元及strict TypeScript／production build通過；既有來源與新presentation標準庫hash驗證通過。
- [原來源68項](../../artifacts/scenic-snow/original-source-assets.json)、[源時鐘5項](../../artifacts/scenic-snow/source-clock.json)、[生命周期21項](../../artifacts/scenic-snow/player-lifecycle.json)、[整站60項](../../artifacts/scenic-snow/site/checks.json)、[漸進啟動37項](../../artifacts/scenic-snow/progressive-start.json)，共191項。新MC圖的HD首幀與實際Canvas RGBA完全一致；圓內218,964個CSS像素對HD nearest預期0差。
- 首屏實驗先阻塞主JS、再阻塞完整圖集至少3秒，實際video和216片雪都繼續變化；React接管同一節點不重設src／currentTime。[正常循環probe](../../artifacts/scenic-snow/bootstrap-loop-probe.json)區分合法0↔1280邊界與中途重啟。
- 冷圖集首次raster曾造成讀phase後400ms延遲，已用async ImageBitmap和工廠內離屏warmup移到phase讀取之前。最終非緩存中周期首幀：132.256ms讀值對應frame16，繪製2.7ms、pause140.044ms，圓周相位差7.788ms；沒有用放寬時鐘斷言掩蓋。
- [完整全景預覽](../../artifacts/scenic-snow/preview/animation.mp4)使用真實CSS舞台850×627（影片只補偶數邊），包含圈外景色、圓形人物和獨立雪，768張／120fps編碼／6.4秒／5個周期。控制rAF及bootstrap讀值僅用於可重複截幀；真實autoplay證據在獨立啟動測試，不把控制時鐘稱為實體螢幕FPS。
- [Production性能](../../artifacts/scenic-snow/performance.json)：單一Chromium1440×1100／DPR1、無節流、完成高清接手／背景載入後穩定2.5秒，獨占12.8秒取樣，期間沒有截圖或其它瀏覽器。人物與雪各768次繪製、各60.00／秒；同一rAF timestamp合併兩回調成本，中位2.5ms／p95 3.1ms／max5.8ms，0長任務／Worker／JS及HTTP錯誤。本地高清ready約1050ms，期間已有首屏video／雪，不能將ready時間當成首動時間或外推使用者網路。

Boot檔950,554 bytes，保持716×534／125fps；圖集是原生358×267的160張壓縮PNG，沒有傳輸／解碼一份四倍面積的完整HD圖集。runtime僅保留四份HD重用buffer，ImageBitmap與video source有明確釋放；原始工程、生成母版、位移字段和QA影片不隨首頁請求下載。
