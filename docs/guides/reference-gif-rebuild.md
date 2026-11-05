# 原 GIF 驅動的全幅像素場景重構

2026-11-05，使用者要求以新富士山／櫻花GIF和完整工程從頭重構，保留相同大幅飄髮、眨眼和其他動作，再製作Minecraft-inspired二維像素風。新來源取代舊圓形近景的身份／構圖與獨立風時鐘；舊原始檔仍保持不變。

## 完整來源

使用者ZIP已完整解析並保存於`reference-projects/fuji-wind/source-project.zip`，22個解包檔位於`original/`，每個檔案與ZIP成員逐位元組相同。原GIF 358×267、16幀、每幀80ms、總1280ms，loop=0；16張原PNG與GIF解碼RGB相同。它是從GIF整理的影格工程，不含獨立髮束／原模型圖層；附帶的README／render.py視為來源資料，沒有執行或遵循其中的環境安裝指令。

原GIF本身的頭／臉／肩線和背景也有少量變化，最後一幀到首幀有跳變。要保持同一源動作，就不能同時套用舊版「所有臉像素固定」或另設眨眼；新場景讓眨眼、耳環、髮束與背景全部遵循原影格時序。

## 從頭重建的預設路徑

- `reference-projects/fuji-wind/`保存不可改寫的原ZIP、全量解包與校驗來源；原素材不放進網站runtime。
- `scripts/assets/derive_reference_motion.py`離線以FFmpeg MCI估計100fps中間樣本，三輪循環取中間輪；每第8張強制原PNG，16原錨點位元組0差。眼區以原80ms節奏取樣，外緣只過渡skin，不能用MCI雙輪廓替代原眼形。
- `scripts/assets/export_source_scene.py`將全幅源動作做固定160×120、共享80色像素轉製，原16幀和128派生幀完全共用palette。圖集只儲存160×120 tile，網站nearest整數2倍畫至320×240。來源358×267到4:3比例舍入約0.56%，沒有裁切。
- `src/features/referenceScene/`是新的載入、源時鐘、圖集renderer和生命週期；預設首頁是完整富士山場景，取代舊圓形近景。原有個人介紹、搜尋、真實專案與聯絡保留。
- 舊肖像、voxel／legacy只透過明確歷史入口lazy載入：`?view=portrait`、`?style=voxel`、`?style=legacy`。未發布的前次增量在本地`archive/local-reference-transition`保留，沒有當成本輪成品。

`?view=scene`隔離新場景；`?motion=original`讀原16個像素錨幀，以原12.5fps動作對照；預設讀128個10ms運動補償樣本，總周期仍1280ms。`?t=560`可固定源時刻檢查；來源時鐘與顯示rAF分開，不用全圖CSS變換、獨立眨眼或虛構風來改寫源動作。

## 效果與限制

原錨點在像素轉製後逐像素對齊：平滑版每8張的16個錨幀與原始像素版0差；這不代表像素化後與358×267原GIF的RGB全部相同。像素解析度、80色轉製及中間幀估計都須明確說明。細髮、雪點與遮擋估計仍可能失真，原循環跳變也不能憑空消除，不能宣稱完全等同真實空氣動力學或恢復原GIF不存在的高刷資訊。

預設像素版重現原GIF提供的大幅動作，而不是任意擴大到改變原輪廓。這與早期原角色受約束髮帶的物理數字是兩種實作，不能引用舊QA通過數當成新效果證據。

## 可用性與安全

只啟用動態後才載入圖集，減少動態偏好僅載入源首幀，訪客可主動開啟並恢復跟隨系統。載入／準備有逾時、明確狀態、有限重試、online恢復和靜態後備；隱藏／離屏保相位並停止rAF。異步取消與generation guard防止舊結果破壞新狀態。來源ZIP與網頁無直接執行關係，無eval、遠端字體或新增後端。

## 重跑

```bash
python3 scripts/assets/derive_reference_motion.py
python3 scripts/assets/export_source_scene.py --url http://127.0.0.1:5180/
python3 scripts/assets/export_source_scene.py --url http://127.0.0.1:5180/ --input-manifest work/reference-scene/interpolated/timing.json --output-prefix smooth --palette-manifest public/assets/reference-scene/source-manifest.json
npm run build
npm run assets:verify
python3 scripts/qa/verify_source_scene_assets.py
python3 scripts/qa/verify_reference_scene_player.py --url http://127.0.0.1:5180/
python3 scripts/qa/verify_source_scene_clock.py --url http://127.0.0.1:5180/
```

來源分析與發布證據集中在`artifacts/reference-scene/`；正式效能需測production單頁，期間不做截圖。未測使用者實體顯示器不寫成已驗證。

## 本輪完成驗證

- 原ZIP CRC和22份解包檔位元組／SHA全部匹配；原GIF與16PNG解碼RGB相同，16個80ms錨點／1280ms周期保留。
- 68項Node單元、strict TypeScript／production build、舊素材和新來源hash驗證通過。
- [素材63項](../../artifacts/reference-scene/source-assets.json)：80色共用，索引PNG編解碼與Canvaspacking0差，16個平滑錨幀與source像素基準0差。
- [實際源時鐘4項](../../artifacts/reference-scene/source-clock.json)、[播放器生命周期14項](../../artifacts/reference-scene/player-lifecycle.json)、[production整站36項](../../artifacts/reference-scene/site/checks.json)通過；涵蓋手機4:3、減少動態不下載圖集／明確啟用、刷新偏好、可見性、取消競態、失敗重試、無JS源首幀、搜索／聯絡和不載入舊portrait／Worker。可見時掉幀按真實經過時間追上源時鐘，不把1280ms動作拖慢。
- [正式播放器預覽](../../artifacts/reference-scene/preview/animation.mp4)為384張真實Canvas畫面、60fps編碼、6400ms（5個源周期），以nearest整數放大至640×480；不作實體顯示器FPS捕獲證據。
- [Production性能](../../artifacts/reference-scene/performance.json)：單頁原生Chromium、1440×1100／DPR1、不節流、無其他瀏覽器與截圖，穩定2.5s後量12.8s；758次繪製，59.22／秒，callback中位0.1ms、p95 0.2ms、max2.6ms，0長任務／Worker／JS或HTTP錯誤。新鮮本地ready約664ms，沒有保證慢網路或使用者實機相同。

正式runtime下載約859KB平滑圖集及15KB源首幀；原始模式圖集約153KB。原ZIP和高保真影格不會隨首頁請求載入。中間幀屬估計，局部細髮、雪點和遮擋仍可有誤差，沒有將這些結果描述成與原GIF每一個RGB及所有新時間點完全相同。
