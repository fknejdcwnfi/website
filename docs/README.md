# 文件入口

目前是完整Minecraft像素風個人網站：個人內容與可擴充帳號配置、透明無框Vermouth近景、分層髮束和局部眨眼。使用者已恢復自動合併與網站更新；PR檢查通過後，依GitHub Actions／Pages流程發佈。

## 現行指南

| 文件 | 解決的問題 |
| --- | --- |
| [個人網站](guides/personal-site.md) | 首頁、真實內容、B站／抖音與遊戲帳號的設定、未來擴充 |
| [Living Portrait](guides/living-portrait.md) | 角色身份、原近景構圖、像素格、透明邊緣及動畫邊界 |
| [參考風動與高更新率](guides/reference-wind.md) | 髮束、眨眼、遮擋修復、真實截幀與效能證據 |
| [開發指南](guides/development.md) | 目錄、指令、除錯、QA及PR／發佈流程 |
| [素材清冊](guides/asset-inventory.md) | 原始來源、canonical／底圖、runtime、字體與使用限制 |
| [決策紀錄](decisions.md) | 各階段採用、取代與授權的原因 |

第一次開發先讀根目錄[README](../README.md)、[AGENTS](../AGENTS.md)，再依工作閱讀上述指南；改視覺前必讀角色及素材契約。提交規範見[CONTRIBUTING](../CONTRIBUTING.md)。

## 歷史與凍結資料

[archive/](archive/)保留原anime／voxel階段文件，每份頂部都標示歸檔日期與目前入口。其中的舊來源路徑、no-UI限制、渲染路線與量測只適用當時階段，不能覆蓋現行指南或當作本輪證據。

| 歷史文件 | 原用途 |
| --- | --- |
| [專案章程](archive/01-project-charter.md) | 最初範圍與非目標 |
| [動畫規格](archive/03-animation-spec.md) | 原十關鍵姿態與動作要求 |
| [架構](archive/04-architecture.md) | 原播放器及Stage路線 |
| [Codex交接](archive/06-codex-handoff.md) | 早期代理操作範例 |
| [QA清單](archive/07-qa-checklist.md) | 早期驗收流程 |
| [圖層計畫](archive/09-layer-plan.md) | 原anime圖層／clean plate研究 |
| [像素舞台](archive/10-pixel-stage.md) | 已封存voxel方案及當時實測 |

[reference/](reference/)的原始委託、分鏡與README保持原路徑及逐位元內容不變。它們記錄原始意圖，包含舊目錄連結與過時指令；閱讀時以本入口的新路徑及現行指南為準，不改寫原文。

## 維護規則

使用者較新的明確要求優先。現行網站以個人網站指南為準，身份與素材以Living Portrait／素材清冊為準，動作與新量測以參考風動指南為準。決策歷史不因新要求而刪除；追加ADR說明變更，歷史文件不重新冒充目前規格。

程式行為、目錄或發佈流程變動時同步文件與CHANGELOG。相對連結需能從所在文件開啟，截圖與數值必須來自實際網站並附量測條件。密集截幀、GIF編碼率、模擬更新率及實際螢幕繪製率需分別記錄。
