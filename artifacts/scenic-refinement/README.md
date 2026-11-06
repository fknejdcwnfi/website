# 2026-11-06 圓形場景再精修證據

本輪在PR20的已發佈版本上繼續打磨，舊`artifacts/final-scene/`不改寫。

- `assets.json`：22份原ZIP檔案、16錨點、96原色、64幀及2864×2136首幀重建核對。
- `site/checks.json`：134項production Chromium檢查，22個RGBA精確對照、純入口動畫、可見樱花、4／6／8倍Canvas、相位／偏好／故障恢復與單次讀回。旁邊PNG是實際網站／CSS圓形截圖。
- `preview/`：實際534px圓形的6.4秒連續截幀，384張畫面以60fps編碼；來源過渡50fps，原片仍12.5fps。
- `performance*.json`：各自新開單一1440×1100 Chromium，2秒穩定、12秒量測，沒有截圖或並行瀏覽器；DPR1及DPR4分開執行，未驗證實體螢幕FPS。
- `style/`：離線72／88／96色對照及全16原幀的RGB誤差；圖中放大和色彩恢復不代表新增原畫資訊，也不是瀏覽器效能證據。

重跑命令、來源界線與記憶體取捨見[目前指南](../../docs/guides/poetic-pixel.md)。
