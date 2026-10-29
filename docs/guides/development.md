# 開發指南

使用Node24及既有checkout。首頁是完整Minecraft像素風個人網站，內容設定與動畫rig互相獨立。產品與帳號欄位見[個人網站](personal-site.md)，角色及最新動態見[Living Portrait](living-portrait.md)與[參考風動](reference-wind.md)。

## 啟動與核心檢查

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
npm run preview
```

`dev`的base為 `/`，預設5173；production preview的base為 `/website/`，預設4173。以終端實際輸出的port為準。`build`的prebuild先跑Node測試，再型別檢查與Vite打包；一般建置只需Node及npm。Python的Pillow／Playwright／Chromium僅用於素材匯出與瀏覽器QA。

## 目錄與責任

| 路徑 | 責任 |
| --- | --- |
| `src/app/App.tsx`、`SiteBoundary.tsx`、`styles/base.css` | 首頁組合、整站錯誤備援及基礎樣式 |
| `src/features/profile/content/` | `site.ts`個人設定、`site.example.ts`非runtime範例、`staticMarkup.ts`靜態HTML |
| `src/features/profile/components/`、`styles/` | 頁首／頁尾、內容、圓形肖像容器與Minecraft像素UI |
| `src/features/profile/presentation/pixelViewport.ts` | 按可用寬度及DPR計算整數實體像素倍率與原點對齊 |
| `src/features/portrait/animation/` | 時間軸、選項、播放器生命週期 |
| `src/features/portrait/renderer/` | 調色盤、素材載入、分層髮束、眼瞼與局部像素繪製 |
| `src/features/portrait/components/` | Canvas展示、錯誤備援、debug控制 |
| `src/shared/animation/types.ts` | 目前與歷史動畫共用型別 |
| `src/archive/legacy/`、`voxel/` | 明確style網址才動態載入的歷史實作 |
| `scripts/assets/` | 衍生素材、runtime匯出、來源／雜湊驗證 |
| `scripts/tests/` | Node內建單元檢查，不增設測試框架 |
| `scripts/qa/` | 實際網站截幀、完整網站／角色檢查、效能量測 |
| `scripts/deploy/` | 手動gh-pages備援 |
| `archive/runtime/portrait-v2/` | 舊不透明runtime歷史，移出public與production打包 |
| `archive/evidence/portrait-v2/`、`portrait-v4/`、`portrait-v5/` | 保留原圖檔與原JSON的歷史量測，不作當前結果 |
| `docs/guides/`、`docs/archive/`、`docs/decisions.md` | 現行指南、舊階段歷史、決策 |

`assets/source/**`與`docs/reference/**`保持原路徑、內容唯讀；不要以整理目錄為理由移動或重新編碼。新的canonical／髮後素材來源見[素材清冊](asset-inventory.md)。

## 個人化與除錯

名稱、HELLOWORLD、介紹、作品、社群與遊戲資料從 `src/features/profile/content/site.ts`修改。`SiteShell`提供共用版面與內容插槽，新增真實功能需同時更新導覽及 `staticMarkup.ts`；不把個人文案寫進renderer。

正常首頁沒有公開播放／暫停控制；可見時12秒微風持續、24秒獨立眨眼事件循環，減少動態／分頁隱藏／離屏停止重畫並保留相位。除錯例子：

```text
/?view=portrait&debug=1
/?view=portrait&t=4510
/?view=portrait&pose=5
/?view=portrait&pixel=192
/?view=portrait&pause=1
/?view=portrait&style=legacy
```

`pose`、`t`及明確`pause`會固定狀態；其他wind、direction、gust、stiffness、damping、speed與手動眨眼在debug調整，範圍由 `stageOptions.ts`驗證。方形邏輯畫布保留二值透明；首頁及獨立檢視以居中圓形容器呈現，沒有相框。DPR尺寸只在resize／DPR變動時更新。

## 素材與瀏覽器QA

以下指令從repo根目錄執行。另開終端啟動dev，匯出只處理衍生素材，不改母版／原始來源：

```bash
python3 scripts/assets/export_portrait.py --url http://127.0.0.1:5173/
python3 scripts/qa/verify_portrait_browser.py --url http://127.0.0.1:5173/ --output artifacts/flowing-hair/qa.json
```

production build後啟動preview，檢查完整網站、擷取真實Canvas及量測：

```bash
python3 scripts/qa/verify_personal_site.py --url http://127.0.0.1:4173/website/
python3 scripts/qa/capture_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/flowing-hair
python3 scripts/qa/measure_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/flowing-hair/performance.json
```

素材匯出與角色探針會讀取Vite source模組，使用dev網址；網站QA、截幀及效能可使用production。先完成build再量測，單頁穩定後取樣，期間不截圖。高更新率探針與更多樣本的參數、實際結果見[參考風動](reference-wind.md)。

需驗證圓形居中、DPR整數像素對齊、持續微風與獨立眼時鐘、原近景、透明／固定42色、髮根與臉部固定、風動與眨眼各自成立、完整循環、連續多輪、明確靜止覆寫及資源清理。完整網站另檢查320／390／768／1440寬度、鍵盤跳至內容、真實連結、可選帳號配置、無JS及六種故障備援。主module被攔截、素材503／12秒逾時、Canvas失敗及兩個歷史模式chunk失敗時仍保留完整內容與獨立靜態肖像。

## PR、分支與發佈

`main`是唯一主要開發基準。任務分支完成後建立PR，等待相關驗證、CI及審查通過，依已恢復的授權自動合併，再核對GitHub Actions／Pages。保護規則與workflow保持有效。舊任務分支只在確認已合併／內容相同且保留必要備份後清理；有獨立未合併工作則保留並明示。

2026-10-29已完成安全清理：清理當時遠端只保留main；四個已合併祖先分支、PR5的同樹squash分支及舊gh-pages分支移除。遠端 `archive/2026-10-29/pr-5`及 `archive/2026-10-29/gh-pages`標籤已核對，本機歷史另有標籤及已驗證的完整Git bundle。詳見[機器可讀清理紀錄](../maintenance/branch-cleanup.json)；本次任務分支在合併與main樹驗證後再刪除。

Pages網址為 <https://fknejdcwnfi.github.io/website/>，production base `/website/`。若改網域，需同步canonical、OG、sitemap與Pages設定。舊gh-pages分支的歷史保留於archive tag，主要部署仍是GitHub Actions。`npm run deploy`會重新建立並強制推送生成的gh-pages分支，僅在擁有者明確要求手動備援時使用；不要求保留一條閒置部署分支。環境網路政策對公開主機的拒絕不是一般訪客的HTTP回應；可用Actions／Pages API核對狀態。

## 常見排查

| 現象 | 檢查 |
| --- | --- |
| preview的 `/`或資產404 | 使用 `/website/`，確認build完成及Vite base |
| 角色離屏／背景分頁停止 | 預期行為，回到可視區應沿原相位續播 |
| 人物不動 | 系統減少動態、pause／t／pose覆寫及素材是否成功 |
| 顯示靜態人物 | 檢查素材503／逾時／Canvas錯誤；網站內容應仍存在 |
| 社群／遊戲區未出現 | 需真實有效資料；社群HTTPS，遊戲至少公開暱稱或ID |
| 角色邊緣模糊 | 邏輯網格與nearest-neighbor，避免平滑濾波及CSS整圖動畫 |
