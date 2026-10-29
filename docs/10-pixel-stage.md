# 10 · Minecraft 風格像素動態 Vermouth（歷史 voxel 迭代）

> **網站範圍另見 [12 個人網站](12-personal-site.md)**；本文件只作歷史角色風格紀錄。

> **已由最新提示詞取代**：下文記錄前次192²方頭voxel胸像與其實測結果，現在只適用 `?style=voxel`。目前預設是忠於原圖、非Steve／非3D的2D像素立繪，請先讀 [11 Living Portrait](11-living-portrait.md) 與ADR-015。舊版效能結果不得移作新版證據。

- **日期**：2026-10-28
- **方向**：擁有者明確要求 Minecraft 風格、像素動態 Vermouth；取代舊版「禁止像素／Minecraft」限制
- **決策**：[ADR-014](08-decisions.md#adr-014--預設切換為-minecraft-風格像素動態-vermouth)

本文件保留前次voxel版本的產品、動畫、架構與驗收紀錄。舊版的原圖分層計畫保留為歷史與 `?style=legacy` 的參考，不代表已完成 clean plate、PixiJS rig 或原圖逐像素重建。

## 1. 目前效果與邊界

預設為程序化繪製的像素／方塊立體感角色舞台：保留 Vermouth 的白金長髮、藍眼、深色服裝與藍色飾物，以固定的方塊臉部、獨立髮束、局部眼皮與耳環呈現動態。背景的像素光點與方塊配色屬同一視覺語言；角色不以整圖平移、縮放或交叉淡入假裝局部運動。

這是以 Canvas 2D 表現 Minecraft 風格的獨立網站作品，不是 Minecraft 遊戲、官方模型或皮膚匯出器，也不是原圖的逐像素複製。藝術品質需要以截圖與動態檢查持續改進；不得宣稱主觀審美或所有裝置效能已「完美」。

頁面維持單一角色舞台，不新增導航、按鈕、標籤或社群圖示。較新的明確個人化需求可另行擴充網站外殼；本次不預填個資或臆造文案。

## 2. 動畫與靜止契約

- 邏輯畫布為 **192×192**；以 nearest-neighbor 放大，保持清楚的像素邊緣，不載入十張舊姿態圖作預設動畫。
- 主循環 **4800 ms**；風力、髮束、飾物與光點均須在循環接點連續。
- 臉部與身體位置固定；髮根固定，髮尾分組擺動，耳環附著點固定。
- 眼皮只在眼區閉合／張開；眨眼窗口總長 **220 ms**，中心約在 **2300 ms**。鼻、嘴、眉、臉型與身體不跟隨縮放。
- 動態繪製率上限為 **24 fps**，不是保證每台裝置恰為 24 fps 或宣稱 60 fps；靜止畫面不持續排程 rAF。隱藏分頁暫停，恢復時保留相位。
- `prefers-reduced-motion: reduce` 無姿態覆寫時顯示靜止姿態 1；角色、光點及背景動態一併停止。
- `?pose=1..10` 凍結整個場景供檢查；1 與 10 為同一靜止狀態。指定姿態與 reduced motion 同時出現時，仍須維持靜止，不得讓背景繼續動。

## 3. URL 個人化與除錯

這些參數可直接修改網址，不需要編輯來源或提供秘密值。它們不新增常駐操作 UI。

| 參數 | 值／預設 | 用途 |
| --- | --- | --- |
| `style` | `voxel`（預設）、`legacy` | 切換新像素舞台與舊原圖交叉淡入預覽 |
| `theme` | `midnight`（預設）、`emerald`、`amethyst` | 午夜藍、翡翠、紫水晶舞台配色 |
| `wind` | 0–1，預設 0.65 | 調整像素髮束風力強弱；0 為無風 |
| `speed` | 0.25–2，預設 1 | 播放速度倍率；不影響固定姿態 |
| `seed` | uint32，預設 7 | 可重現的背景星點與髮絲紋理；移動光點本身沿固定週期運動 |
| `pose` | 整數 1–10 | 凍結姿態，1／10 應一致 |
| `debug` | `1` 開啟 | 顯示目前時間與狀態，僅除錯時出現 |

數值必須經有限值、範圍與整數檢查；無效輸入回到支援值，不能導致 NaN、無窮大或壞掉的畫布。legacy 模式保留舊版的 2300 ms 時間軸與姿態語義；新風格的主題、風力、seed 不應改寫舊素材。

範例（production）:

```text
/website/
/website/?theme=emerald&wind=0.35&speed=0.75&seed=42
/website/?theme=amethyst&pose=5&debug=1
/website/?style=legacy&pose=5&debug=1
```

## 4. 實作與可維護性

| 路徑 | 責任 |
| --- | --- |
| [voxelScene.ts](../src/animation/voxelScene.ts) | 可重現的像素角色、背景與局部動態繪製；`THEMES` 是可編輯調色盤，不依賴網路紋理 |
| [voxelTimeline.ts](../src/animation/voxelTimeline.ts) | 4800 ms 週期取樣、220 ms 眨眼與固定姿態語義 |
| [voxelPlayer.ts](../src/animation/voxelPlayer.ts) | 播放速度、24 fps 節流、靜止／可見性與資源清理；固定 192² bitmap，由 CSS 響應式放大，不建立 resize listener |
| [stageOptions.ts](../src/animation/stageOptions.ts) | URL 選項驗證與預設值 |
| [CharacterStage.tsx](../src/components/CharacterStage.tsx) | 選擇 renderer、Canvas 可及性、媒體偏好與除錯資訊 |
| [player.ts](../src/animation/player.ts) | 保留的 legacy 原圖播放器，仍是 provisional |

Native Canvas 2D 不新增 renderer 或美術工具依賴。預設模式不需圖片、外部字型、CDN、登入、後端或資料庫。新 [og-pixel.png](../public/og-pixel.png) 為實際 renderer 的 768² 截圖，供分享 metadata 使用；舊 WebP、manifest、`og-image.webp` 與來源素材仍保留。`npm run assets:verify` 檢查新 OG 圖與舊資源，不能把這個檢查當作新像素角色的視覺驗收。

未來個人化應保留分離：主題色與視覺設定、動態參數、程序化角色外形、頁面內容和部署路徑各自調整。改網站文案不應重做髮束繪製；改風力不能解除臉部固定與 reduced motion；不把 seed 當成任何身份或追蹤資料。

## 5. 必需驗證

建置與測試均使用 Node 24，從 repository 根目錄執行：

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
```

`npm run build` 的 `prebuild` 自動執行 `npm test`，因此現有 CI／Pages build 會跑相同八個單元檢查，無須修改 workflow。

瀏覽器驗證至少包含：

- 桌機 1200×1000 與手機 390×844／DPR 2；舞台完整、無水平捲動，像素邊緣清晰。
- 預設模式已繪製，無頁面例外、失敗請求、空白畫布或常駐 HUD。
- 多個時間點可見髮尾／眼皮／耳環局部變化，臉部與身體不作整體運動；4800 ms 接點連續。
- 姿態 1／10 畫布一致，姿態 5 可檢查閉眼；相同 seed、時間、選項重繪結果一致。
- reduced motion、固定姿態與隱藏分頁都停止無意義更新；恢復後不建立重複迴圈。
- 三種主題、wind 0／1、speed 邊界、無效 URL 輸入與 legacy 模式都可運作。
- 以真實執行資料記錄更新間隔、長任務與檢查條件；容器 headless 結果不得冒充實體手機效能。
- 原始 SHA 不變、既有素材驗證通過；PR 的 CI 通過後自動合併，再確認該提交的 Pages 部署成功。

不勾選或捏造未執行結果。舊 anime 模式的身份像素差分、clean plate 與 P1–P7 流程，只對其原圖 rig 計畫適用，不用來否決使用者新要求的像素造型，也不能宣稱新 renderer 已完成舊計畫。

## 6. 本次驗證紀錄

2026-10-28 的 production build，以容器內 Chromium 進行 **29 項功能檢查，全數通過**，涵蓋新舊模式、各主題、參數邊界、靜止／減少動態及響應式畫面。預設模式沒有請求來源姿態圖；原始素材保持唯讀。README 的 [桌機](assets/pixel-stage-desktop.png) 與 [手機](assets/pixel-stage-mobile.png) 圖為本次實際截圖，其中手機截圖為 390×844、DPR 1；驗證尺寸與截圖 DPR 應分開記錄。

fresh production 的五秒繪製抽樣為 **120 次、23.99 fps**；每次繪製 CPU 時間中位數 **0.5 ms**、p95 **1.2 ms**，未觀察到長任務。此處量測的是該容器與瀏覽器條件下的繪製成本，不是實體手機效能或所有裝置的保證，也不是對主觀視覺品質的完美宣告。
