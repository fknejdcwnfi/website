# 單向自然風與動畫恢復

日期：2026-11-04。使用者回報電腦瀏覽器一直靜止，並希望頭髮像自然風一樣連貫。這次上傳的 `animation-60fps.mp4` 與前次產生的預覽逐字節相同，因此用其作為舊效果對照，不將預覽編碼幀率當成實際顯示幀率。

## 動作

240 Hz 約束骨鏈及 120 Hz 週期姿態緩存保留。原先的水平載荷乘以各束左右側，造成同一陣風同時向兩側張開；現在兩側受同一世界方向載荷，髮根固定、髮尾因慣性延後，增加循環底風並降低向上載荷。原素材缺少完整的遮擋後表面，朝臉的風力因而低於向外側，避免侵入固定臉部；一側的可見位移會較小。眼瞼仍走獨立 24 秒時鐘，沒有整幅人物變換。

原先要求兩側長捲髮可見中段位移至少 10、行程至少 8、髮尾至少 18 個像素，且彎曲至少 0.1 弧度；該門檻與單向風及臉側遮擋相衝突，因此改為兩側可見中段位移至少 6、行程至少 5，且至少一側分別達 10／8 個 256 網格像素；另測髮尾、彎曲、500ms 窗口、臉部、網格及接縫。120 係數實測左／右長捲髮中段位移 6.95／18.14，行程 6.28／16.05，完整髮尾 10.95／28.53 個邏輯像素。不同風向和視覺遮擋仍需人工審視；debug 反向風的臉側髮束有較密的重疊線條。這是二維切片與約束模型，並非完整三維逐根頭髮或流體模擬。

## 首次載入恢復

桌面正常環境可自動播放，但已重現首次圖集或 Worker 失敗後，舊版會一直停在靜態圖，即使連線恢復也不重試。現在保留獨立靜態備援，兩秒與五秒後最多各重試一次；失敗上限後等待網路 `online` 才可再嘗試。首次真實繪製成功後才移除備援，卸載時清除 timer、監聽器與播放器。若故障持續，顯示簡短狀態。系統「減少動態」仍靜止，離屏／隱藏仍暫停。

不能從本地故障注入判定使用者的電腦實際遇到哪一種原因；JavaScript 無法載入、瀏覽器設定或系統減少動態仍可能顯示靜態頁面。正常桌面、暫時資產／Worker 故障、持續故障重試上限及 online 恢復以瀏覽器測試驗證。

## 頁面細節

首頁標題輕入場與間歇揮手、提示圖示輕閃；導覽、搜尋、作品與連結有簡短 hover／鍵盤焦點反饋。動畫及過渡只在 `prefers-reduced-motion: no-preference` 啟用，人物不做整體平移或縮放。

## 驗證與證據

Node 單元測試 60 項、角色瀏覽器 QA 64 項及整站 QA 84 項通過；角色檢查中 4,085 個核心臉像素保持不變。實測含圖集／Worker 暫時故障恢復、連續失敗的重試上限與網路恢復；程式及測試範圍不代表已取得使用者裝置的實際錯誤。

[Production 性能數據](../../artifacts/natural-wind/performance.json)：同一容器 headless Chromium 原生排程 12 秒錄得 720 次繪製（60 次／秒），callback 中位 1.0ms、p95 1.4ms，無 50ms 長任務；解除限幀測得 573.72 次／秒、中位 1.3ms、p95 1.7ms，低於前次記錄的 793.61 次／秒，不能聲稱所有吞吐指標改善。解除限幀會將主執行緒推至高負荷；這些數字均不代表實體高刷新顯示器表現。

```bash
npm run build
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_layered_portrait.py --url http://127.0.0.1:5173/ --output artifacts/natural-wind/qa.json
python3 scripts/qa/verify_personal_site.py --url http://127.0.0.1:4173/website/ --output artifacts/natural-wind/site
python3 scripts/qa/measure_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/natural-wind/performance.json
python3 scripts/qa/capture_portrait_video.py --url http://127.0.0.1:4173/website/ --output artifacts/natural-wind/portrait/animation-60fps.mp4
```

[桌面截圖](../../artifacts/natural-wind/site/desktop.png)、[手機截圖](../../artifacts/natural-wind/site/mobile.png)、[實際播放器 60fps 審查影片](../../artifacts/natural-wind/portrait/animation-60fps.mp4)。影片由受控時間戳的實際 production CSS 截圖編碼，並非即時顯示器 FPS 實測；本環境沒有量測使用者實體螢幕或瀏覽器。
