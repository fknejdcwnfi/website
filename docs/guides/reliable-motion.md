# 持續風動與可辨識的播放狀態

2026-11-05，擁有者再次確認「網頁能顯示，頭像一直不動」，刷新沒有解決；尚未取得其瀏覽器名稱或實際 console／網路記錄。不能把本地正常播放或 Pages 部署成功當成使用者電腦已修好。

## 播放路徑

前版仍完全依賴 module Worker 準備物理，重試不能解決永久不可用的 Worker。預設四個物理參數現在直接載入同一求解器產生的 Float32 週期姿態，省去訪客端數值預熱；非預設 debug 參數仍用 Worker。緩存下載或完整性驗證失敗時回退 Worker，再沿用有限重試／online 恢復與靜態保護。素材或主 JavaScript 無法下載仍無法運行動畫。

`scripts/assets/export_baked_physics.mjs` 以各尺寸獨立求解器生成資料。內容雜湊檔名和嵌入主程式的描述符避免新舊版本混用；載入時核對實際 SHA-256、長度、header、有限座標、rest 綁定、固定髮根與首尾一致。`physics-manifest.json` 記錄程式、binding 和輸出來源，`npm run assets:verify` 阻擋風場改動後未重新匯出。只下載所用網格的緩存，每份約 1.48MB，代價是增加首次網路傳輸；這不是預錄影片，runtime 仍以 rAF 時間插值並局部繪製原像素材質。

## 靜止的說明與選擇

系統 `prefers-reduced-motion: reduce` 仍預設靜止，但現在顯示原因和「開啟動態」。訪客主動選擇後只開啟角色，並可按「跟隨系統」恢復；選擇保存在本機，storage 不可用也可以在當次頁面啟用。正常無此偏好時沒有播放控制。離屏和隱藏分頁仍停止排程並保留相位。

載入超過 1.5 秒有準備提示，角色失敗有「重試載入」；首次成功 paint 後才移除後備肖像。主 module 在 12 秒內尚未啟動時，初始 HTML 顯示靜態模式說明；JavaScript 被禁用時有 noscript 說明。正式 JS 目標降至 ES2020，以降低較舊瀏覽器的語法門檻；這不等於所有舊版瀏覽器已實機驗證。

## 風與身份

短促且分離的強陣風改為重疊的寬緩風波，避免反覆張開／回到近似休息位的節奏；保留 12 秒閉合週期、同一世界風向、根部固定、末端延遲和獨立 24 秒眨眼。二維原始切片的遮擋及隱藏面限制仍存在；不以增加振幅、換臉或整圖變換掩蓋問題。

## 重跑

```bash
node scripts/assets/export_baked_physics.mjs
npm run build
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_layered_portrait.py --url http://127.0.0.1:5173/ --output artifacts/reliable-motion/qa.json
python3 scripts/qa/verify_personal_site.py --url http://127.0.0.1:4173/website/ --output artifacts/reliable-motion/site
python3 scripts/qa/measure_portrait_startup.py --url http://127.0.0.1:4173/website/ --output artifacts/reliable-motion/startup.json
python3 scripts/qa/measure_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/reliable-motion/performance.json
```

測試結果與實際截圖放在 `artifacts/reliable-motion/`。影片編碼率、容器 rAF、模擬高刷新率及使用者實體裝置表現分開說明。

## 本輪驗證記錄

60 項 Node 單元、型別與 production build、素材及預烘焙來源驗證通過。整站 84 項通過；初輪整站測試在並行截幀時等待離屏暫停逾時，獨立重現可正常暫停／恢復，完整重跑通過，未將初輪視為通過。

三尺寸緩存共比較 1,107,456 個 Float32 值，192／256 與各自瀏覽器新鮮求解器一致；320 有一個值相差一個 Float32 相鄰值（0.0000152587890625 像素），其餘一致，diagnostics一致。這是 Node／Chromium 數值運行時的舍入差，不能宣稱三尺寸全部逐位元一致；驗收記錄實際差異並限制在單精度舍入範圍。

[實際預覽影片](../../artifacts/reliable-motion/portrait/animation-60fps.mp4)包含 720 張實際 CSS 圓形畫面，12 秒／60fps 編碼；[逐秒總覽](../../artifacts/reliable-motion/portrait/contact.png)保留外觀檢查，[減少動態提示](../../artifacts/reliable-motion/site/reduced-choice.png)保留明確狀態與按鈕。影片不是即時螢幕 FPS 驗證，也不能保證使用者裝置的載入與播放。

[角色 QA](../../artifacts/reliable-motion/qa.json)最終 79 項通過，包括預設 Worker 永久不可用仍播放、損壞緩存的 Worker 回退、明確動態選擇與主 module 恢復。4,085 個核心臉像素變化為 0；左／右卷髮可見中段行程 6.08／15.82 像素，循環邊界兩側相隔 2ms 的位置差約 0.00536 像素。原臉部、色盤、網格及 blink 門檻保留。[整站 QA](../../artifacts/reliable-motion/site/checks.json)84 項通過。

Production 原生排程完整 12 秒量到 720 次繪製（60／秒），callback 中位 1.1ms、p95 1.6ms，穩態沒有 50ms 長任務。[冷啟動](../../artifacts/reliable-motion/startup.json)動畫 ready 約 755ms、0 Worker（前次本地記錄約 1.90 秒），仍有最多 80ms 的初始化長任務；靜態約 693ms、最多 92ms 長任務。量測為本地無網路節流，1.48MB 新傳輸量在慢網路可能更慢，不當作使用者實機保證。
