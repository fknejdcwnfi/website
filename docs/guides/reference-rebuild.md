# 參考版面與髮束物理重構

- 日期：2026-10-29
- 範圍：既有 GitHub Pages 個人網站；保留個人資料、角色身份與未來帳號設定
- 參考：本輪提供的藍色雙層導航、白底、左右導覽與中央正文截圖

## 實作順序與界線

1. 先核對現有 main、原始素材雜湊及測試，保存同環境 production 效能基線。
2. 將網站外殼重構為文件式三欄，正文維持個人介紹、真實作品及聯絡；不將課程成績、規則或課程功能當成個人資料。
3. 搜尋只索引實際存在的本站內容，支援鍵盤與結果跳轉；初始靜態 HTML 保留相同正文與導覽。未填的社群與遊戲資料不顯示。
4. 肖像沿用同一 canonical 二維像素近景、透明材料及無框圓形，保留已接受的獨立眨眼。優化局部髮束物理響應與反向取樣，不更換臉或整張圖晃動。
5. 通過型別、建置、素材、網站與角色瀏覽器檢查後，量測 production 效能；以 PR、CI 及既有 GitHub Actions 發佈，核對部署結果。

## 語言與效能選擇

保留 strict TypeScript、React 與原生 Canvas 2D。這個 256² 局部像素角色的主要成本在採樣與繪製；單純換成 Rust/Wasm 並不會省去 Canvas 上傳與瀏覽器合成，反而增加記憶體交換、打包與除錯負擔。先消除像素迴圈的重複運算，將固定資料預算，讓頁面內容與角色時鐘繼續獨立演進。沒有新增第三方 runtime、外部字體請求、後端或登入。

「物理」指有界髮束與耳環的阻尼彈簧響應，並非完整三維毛髮、空氣動力學或逐根髮絲碰撞。像素格仍離散，不能把相鄰 rAF 相同的像素當成掉幀。12 秒微風與 24 秒獨立眼時鐘保持不變，顯示器刷新率只改取樣密度。

## 驗收

- 桌面藍色雙層頭欄、左導航、中央白底正文及右目錄；手機不水平溢出，目錄與搜尋可鍵盤操作。
- 真實作品及封存狀態、Email、GitHub、HELLOWORLD 與設定擴充保留；JavaScript 或角色失敗時完整內容仍可閱讀。
- 臉部、髮根、項鏈與固定身體不變；局部眼瞼僅改原眼區，髮動與眨眼並行。
- 圓形內可見中段有持續風動；固定 42 色、二值 alpha、最近鄰、DPR 對齊及無相框維持。
- 接縫位置／速度、跨多輪、60／120／144／240 Hz 同時間取樣與生命週期通過檢查。
- 原生 rAF 與不限幀吞吐分別記錄；效能量測期間沒有截圖或其他瀏覽器工作。容器吞吐與 GIF 編碼不代表實體高刷螢幕。

新證據放在 `artifacts/reference-rebuild/`。舊 `flowing-hair`、`gentle-portrait`、`pixel-world` 保留歷史數據，不能代替本輪實測。沒有本輪可讀取的影片檔或連結，因此使用既有原始參考、十張動作圖及 GIF 判斷動作，不宣稱已逐幀對齊未提供的影片。

## 重跑本輪檢查

```bash
npm run build
npm run assets:check
npm run assets:verify
# 分別啟動 dev 與 production preview 後，依序執行，避免瀏覽器互相干擾效能
python3 scripts/qa/verify_portrait_browser.py --url http://127.0.0.1:5173/ --output artifacts/reference-rebuild/qa.json
python3 scripts/qa/verify_raster_cache.py
python3 scripts/qa/verify_personal_site.py --url http://127.0.0.1:4173/website/ --output artifacts/reference-rebuild/site
python3 scripts/qa/measure_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/reference-rebuild/performance.json
python3 scripts/qa/capture_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/reference-rebuild/portrait
```

可達候選區驗證將快取跨度與原完整field跨度直接比較，涵蓋192／256／320三種網格、六種方向／陣風／剛度／阻尼／風量設定及十個時刻，總計180組。這個檢查關注優化前後輸出是否一致，與角色美術／固定區檢查分開。

## 本輪結果

- 47項Node單元、strict型別及production build通過，素材／原始來源驗證通過。
- [肖像QA](../../artifacts/reference-rebuild/qa.json)58項通過：27,519個保護像素、160個髮根保持固定，眨眼差分僅限眼區，42色與二值alpha、無內部破洞、100輪與多Hz取樣維持一致。
- [網站QA](../../artifacts/reference-rebuild/site/checks.json)84項通過，正常瀏覽器沒有JS／HTTP錯誤。包含搜尋、真實錨點、鍵盤焦點、手機目錄、四寬度、DPR1／2、無JS及六種故障備援。Chromium在錨點切換時可能重新驗證同源favicon，記錄中僅排除該無查詢字串圖示請求，沒有搜尋資料／查詢請求。
- [快取與完整field對照](../../artifacts/reference-rebuild/raster-cache.json)180組完全一致。256²預設候選像素64,940→24,568，減少62.17%；沒有靠減少畫布或限幀提高效能。
- 圓形內兩側臉旁中段峰值約2.15／2.61px，兩條長捲髮可見中段約7.18／5.46px；24個500ms視窗全部有可見非眼區像素變化，最少568像素。這是有界動作與可見性驗證，不宣稱主觀完美。
- 刪除兩個從未讀取的內部陣列，256²單rig減少327,680 bytes（320 KiB）。runtime依賴與原始素材未增加。

### 同環境production性能

每次fresh單頁headless Chromium154、1200×1000、DPR1、無CPU節流；穩定2500ms後取樣完整12000ms風動，量測期間沒有截圖或其他瀏覽器工作。基線是修改前同一環境的main，不挪用歷史量測。

| 版本／排程 | 實際繪製／秒 | callback中位數 | callback p95 |
| --- | ---: | ---: | ---: |
| 原main／原生rAF | 60.00 | 4.4ms | 5.1ms |
| 本輪／原生rAF | 59.75 | 2.4ms | 5.7ms |
| 原main／不限幀 | 208.82 | 4.4ms | 5.3ms |
| 本輪／不限幀 | 403.90 | 2.2ms | 2.7ms |

本輪兩個模式均無超過50ms長任務、JS或HTTP錯誤。中位CPU下降約45%，不限幀吞吐約1.93倍；原生樣本仍有排程抖動，p95比基線高0.6ms，不能宣稱每個尾端指標均改善。完整原始資料見[基線](../../artifacts/reference-rebuild/baseline-performance.json)與[本輪](../../artifacts/reference-rebuild/performance.json)。這些是容器測量，沒有實體高刷顯示器呈現驗證。

原生排程因第一輪p95上升而額外復測一次，同樣fresh單頁與12秒條件，保留原測量。[復測](../../artifacts/reference-rebuild/performance-native-repeat.json)為59.83次繪製／秒、CPU中位2.2ms／p952.7ms，仍觀察到一次40.6ms callback與50.1ms排程間隔；沒有超過50ms長任務。兩次結果都列出，不能用較好的一次抹掉抖動。

### 實際影像

[桌機](../../artifacts/reference-rebuild/site/desktop.png)、[手機](../../artifacts/reference-rebuild/site/mobile.png)與[無JS](../../artifacts/reference-rebuild/site/no-javascript.png)展示同版正常內容。靜態截圖使用減少動態的canonical休息姿態，動態以[完整24秒圓形預覽](../../artifacts/reference-rebuild/portrait/animation_preview.gif)及[時刻圖集](../../artifacts/reference-rebuild/portrait/gallery.html)判讀。

[擷取紀錄](../../artifacts/reference-rebuild/portrait/capture.json)含83時刻、10姿態與10錨點，共103筆映射、57張去重原始Canvas PNG（2,982,162 bytes）。完整GIF從480張50ms間隔的實際圓形截圖編碼，24,000ms、340,251 bytes，480個解碼幀與編碼來源一致。GIF色彩量化平均RGB誤差約1.17／255，原始PNG未更動；20Hz預覽不表示網站即時FPS。擷取無瀏覽器錯誤，pose1與pose10仍一致。
