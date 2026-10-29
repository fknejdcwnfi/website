# 本輪實際網站驗證

先看[首頁動態](website_motion.gif)、[角色動態](animation_preview.gif)，再用[276 個實際畫面圖庫](gallery.html)或[144 格縮圖總覽](contact_sheet_144.png)逐格檢查。[原圖／靜止／風動／閉眼對照](comparison.png)保留身份與構圖參考。

所有動畫畫面都來自 production 網站的 Canvas 或首頁截圖。網站持續使用同一個程序式角色；這個目錄只保存驗證證據，不會放入 `dist` 或變成網站逐幀下載。

- [capture.json](capture.json)：2300 ms 內均勻取樣 276 個時刻（120 次／秒），另含 10 個明確參考姿態、10 個連續時間錨點。
- [frames/manifest.json](frames/manifest.json)：全部 296 筆紀錄映射至 **205 張唯一 PNG，10,787,883 bytes**；位元組相同的 PNG 只存一份。已逐檔核對 SHA-256、大小及 256² 網格。
- 圖庫上方的姿態 4 固定半閉眼；連續時間軸的 630 ms 是閉眼起點。姿態 1／10 完全相同。
- 角色 GIF 使用 115 個實際樣本，編碼後合併為 84 幀、2300 ms；20 ms 編碼時槽取最近的 120 Hz 樣本，最大時間誤差 3.334 ms。首頁 GIF 使用 58 張實際截圖，合併為 43 幀、2300 ms。GIF 取樣率不是即時 FPS。

[肖像檢查](qa.json) **51 項通過**：17 段髮束、局部眨眼、固定臉／根點、像素調色盤及二值透明、100 輪一致；60／120／144／240 Hz 模擬 rAF 在 14 個相同時刻得到一致像素。[完整網站檢查](../personal-site/checks.json) **41 項通過**，包含四種寬度、鍵盤、離屏／減少動態、無 JavaScript 及六種故障備援；截圖見[桌面](../personal-site/desktop.png)、[手機](../personal-site/mobile.png)、[無 JavaScript](../personal-site/no-javascript.png)。

[production 效能](performance.json)使用單頁 headless Chromium 154、1200×1000、DPR1、無 CPU 節流；每次先穩定 2.5 秒，再取樣 5 秒，期間沒有截圖或其他瀏覽器工作。

| 模式 | 實際回呼速率 | 活動風動 callback 中位數／p95 | 強風 callback 中位數／p95 |
| --- | --- | --- | --- |
| 原生容器排程 | 60 次／秒；300 次實際繪製 | 3.9／5.9 ms | 4.0／6.5 ms |
| 關閉 Chromium 幀率限制 | 活動風動約 269.23 次／秒；強風約 271.14 次／秒 | 3.2／5.3 ms | 3.2／4.7 ms |

活動風動為 230–1890 ms，強風為 630–1570 ms；分桶速率由 rAF 時間估算，排除靜止段灌高總體吞吐量。兩次量測都沒有超過 50 ms 的長任務或正常頁面 JS／HTTP 錯誤。CDP TaskDuration 分別為 1.242／5.082 秒；這次記錄的忙碌比值使用較窄的頁面計時窗，只是近似值，無上限模式略超過 100% 不能當成物理 CPU 使用率。腳本已改為讓後續量測使用相同的 CDP Timestamp 時窗。

這是容器中的實際回呼／繪製成本與吞吐量；GPU、合成器、作業系統及實體 120／144／240 Hz 顯示器尚未量測。模擬刷新率用來驗證速度與相位，不宣稱已在這些螢幕實測。
