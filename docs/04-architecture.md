# 04 · 架構

- **狀態**：Stage 1 已實作；Stage 2–4 為設計藍圖
- **最後更新**：2026-10-28
- **適用對象**：前端、Codex Cloud、任何要改動渲染管線的人

本文件分成兩部分：

1. **現況架構**：現在程式怎麼跑，哪些是可保留的基礎。
2. **目標架構**：要如何從「十張圖交叉淡入」演化為「分層角色 rig」。

> 閱讀時請記住：Stage 1 不是縮小版的最終架構，而是**驗證底座**。
> 時間軸、部署、除錯開關、舞台外觀可以保留；渲染核心會被替換。

---

# 第一部分：現況（Stage 1）

## 1.1 總覽

```text
┌─────────────────────────────────────────────────────────────┐
│ index.html                                                  │
│   └─ #root                                                  │
│        └─ <App>                                             │
│             └─ <CharacterStage>                             │
│                  ├─ .stage（CSS 背景 = frame_01 海報）       │
│                  │    └─ <canvas> ← KeyPosePlayer           │
│                  └─ .hud（僅 ?debug=1）                      │
└─────────────────────────────────────────────────────────────┘

KeyPosePlayer
  ├─ 預載 10 張 WebP（Image + decode）
  ├─ requestAnimationFrame 迴圈
  ├─ 由 timeline.ts 取樣目前段落（keyPoses.ts 提供資料）
  ├─ 交叉淡入目前幀與下一幀
  ├─ ResizeObserver + DPR 調整 canvas 尺寸
  ├─ visibilitychange 時暫停
  ├─ 靜止模式停止 rAF
  └─ prefers-reduced-motion 時只畫第 1 幀
```

## 1.2 檔案責任

| 檔案 | 責任 | 穩定性 |
| --- | --- | --- |
| `src/animation/keyPoses.ts` | 十個關鍵姿態的時間、風力、眼睛開合、圖片 URL | **保留**，未來成為 rig 的時間軸資料 |
| `src/animation/timeline.ts` | 純時間軸取樣與交叉淡入計算（無 DOM／Vite 依賴） | 保留，可單元測試 |
| `src/animation/player.ts` | Canvas 2D 播放器：預載、繪製、尺寸、生命週期 | **會被替換**（Stage 3） |
| `src/components/CharacterStage.tsx` | 舞台 DOM、除錯 HUD、URL 參數、減少動態偏好 | **保留**，內部渲染器可替換 |
| `src/App.tsx` | 頁面骨架與氛圍層 | 保留 |
| `src/styles.css` | 舞台尺寸、光暈、暗角、HUD、響應式 | 保留 |
| `scripts/optimize_assets.py` | 原始素材 → WebP + manifest + OG 圖 | 保留 |
| `scripts/verify_assets.py` | 驗證 manifest 雜湊、循環幀與必要靜態檔 | 保留 |
| `public/assets/frames/*.webp` | 衍生幀 | 可重建 |
| `scripts/deploy_gh_pages.sh` | 手動備援：建置並發佈到 `gh-pages` | 保留 |
| `.github/workflows/*.yml` | CI 與 GitHub Pages 自動部署（主要） | 保留 |

## 1.3 執行流程

1. React 掛載 `CharacterStage`。
2. `KeyPosePlayer` 建立 10 個 `Image`，設定 `src`；載入後 `decode()`。
3. `ResizeObserver` 量測 canvas 的 CSS 尺寸，將 backing store 設為 `尺寸 × min(DPR, 2)`。
4. `requestAnimationFrame` 每幀：
   - 計算 loop-local 時間 `t = (elapsed) % 2300`。
   - 由 `timeline.ts` 找到 `t` 所屬的關鍵姿態段落。
   - 在段落尾端 `fade = min(140ms, 段長 × 0.55)` 的窗口內，以 smoothstep 計算 `blend`。
   - 先畫目前幀，再以 `globalAlpha = blend` 畫下一幀。
   - 每 120 ms 透過 `onSnapshot` 回報狀態給 HUD。
5. 分頁隱藏時 `stop()`；回來時 `start()`，並保留大致相位。
6. `prefers-reduced-motion` 或 `?pose=N` 時，只畫單一靜止幀並停止 rAF，避免靜止畫面持續佔用 CPU。

## 1.4 為何用 Canvas 而不是 `<img>` 疊層

| 方案 | 優點 | 缺點 | 結論 |
| --- | --- | --- | --- |
| 10 個 `<img>` + CSS opacity | 實作最簡單 | 10 個合成層、不易控制 draw order、未來 mesh 不相容 | 不採用 |
| Canvas 2D | 控制精確、易加除錯繪製、與未來 WebGL 相近 | 需自行處理 DPR／尺寸／生命週期 | **目前採用** |
| WebGL / PixiJS | 可做 mesh、shader、高效能 | 對 Stage 1 過重 | Stage 3 採用 |

Canvas 2D 讓 Stage 1 的程式碼與 Stage 3 的 renderer 有相似的責任邊界：
`CharacterStage` 只管舞台與偏好，`player` 只管「怎麼畫」。屆時替換 player 即可。

## 1.5 已處理的工程細節

- **DPR**：backing store 跟著裝置像素比，上限 2，避免 3x 手機配置過大的畫布。
- **尺寸**：`ResizeObserver` 監聽 canvas，視窗縮放與 DPR 變化都能重繪。
- **生命週期**：`destroy()` 取消 rAF、斷開 observer、移除事件監聽；React StrictMode 下不會重複播放。
- **分頁隱藏**：`visibilitychange` 時停止 rAF，節省電力。
- **相位保留**：`stop()` 將已播放時間存入 offset，`start()` 從該處續播，避免回到第 1 幀。
- **減少動態**：監聽 media query 變化，即時切換靜止／動畫。
- **載入**：CSS 海報先顯示第 1 幀，圖片解碼完成後 canvas 覆蓋，避免空白。
- **Base path**：所有圖片 URL 經 `import.meta.env.BASE_URL`，適配 GitHub Pages 子路徑。
- **除錯**：URL 參數而非 UI，維持「只有角色」的產品原則。

## 1.6 Stage 1 的技術債

| 債務 | 影響 | 償還階段 |
| --- | --- | --- |
| 交叉淡入不一致的 AI 幀 | 殘影、身份漂移 | Stage 2–3 |
| 沒有圖層與遮罩 | 無法局部變形 | Stage 2 |
| 每幀都是完整 1080² 圖片 | 記憶體與解碼成本較高 | Stage 2 |
| 沒有視覺回歸測試 | 改動可能默默破壞畫面 | Stage 3 |
| 沒有 rig 參數抽象 | 風力只是標量，無法逐束控制 | Stage 3 |
| HUD 只在 URL 開啟時存在 | 自動化測試需自行注入參數 | 可接受 |

---

# 第二部分：目標架構（Stage 2–4）

## 2.1 設計目標

1. **身份鎖定**：臉部幾何永遠來自第 1 幀。
2. **局部變形**：頭髮、眼皮、耳環各自獨立，可分別驅動。
3. **參數化**：風力、相位、阻尼、眨眼時序都是資料，不是硬編碼。
4. **可驗證**：每個圖層、每個參數都能被除錯開關顯示與凍結。
5. **可部署**：仍是純靜態網站，不需要後端。
6. **可接手**：模組邊界清楚，代理不需要讀完整個 repo 才能改一個參數。

## 2.2 技術選型

| 方案 | 適合度 | 優點 | 缺點 |
| --- | --- | --- | --- |
| CSS transform 分層 | 低 | 零依賴 | 只能剛體變換，無法做網格彎曲 |
| Canvas 2D + 手寫網格 | 中 | 無新依賴、可控 | 變形與遮罩需自己寫，效能有限 |
| **PixiJS v8 + Mesh + Shader** | **高（建議）** | 成熟的 WebGL 2D 管線、mesh、濾鏡、批次繪製 | 增加約 100 KB 依賴 |
| 自寫 WebGL2 | 中 | 完全控制、體積小 | 開發成本高，易出錯 |
| Live2D Cubism | 高（若有模型） | 業界標準、自然的臉部與頭髮 | 需 Cubism 模型與授權；從十張圖重建成本高 |
| Spine | 中 | 骨骼動畫成熟 | 2D 網格變形不如 Live2D 自然；需授權 |
| Rive | 中高 | 即時 rig、狀態機、網頁 runtime 小 | 需在 Rive 編輯器手動建 rig；代理難以純文字完成 |

**建議路線**：PixiJS v8 + 自訂 mesh + 風力 shader。
理由：素材是點陣圖，沒有現成 Live2D 模型；PixiJS 可在程式碼中建立 mesh 與權重，適合代理協作與版本控制；不需要美術編輯器才能建置。

若擁有者能提供 Live2D 模型，則優先使用 Live2D，因為臉部與頭髮的品質上限更高。此決策需開 ADR。

## 2.3 目標模組

```text
src/
├─ animation/
│  ├─ keyPoses.ts          # 時間軸（沿用）
│  ├─ timeline.ts          # 取樣、緩動、事件（已存在，可擴充）
│  ├─ wind.ts              # 彈簧阻尼、包絡、噪聲（新增）
│  └─ blink.ts             # 眼皮狀態機（新增）
├─ rig/
│  ├─ layers.ts            # 圖層清單、draw order、錨點（新增）
│  ├─ strands.ts           # 髮束定義、根點、權重、相位（新增）
│  └─ character.ts         # 組裝 Pixi container（新增）
├─ render/
│  ├─ renderer.ts          # Pixi Application 生命週期（新增）
│  ├─ mesh.ts              # 網格建立與變形（新增）
│  └─ shaders/wind.frag    # 風力位移（新增）
├─ components/
│  └─ CharacterStage.tsx   # 舞台外殼（沿用，替換內部）
└─ debug/
   └─ hud.ts               # 除錯顯示（可選）
```

## 2.4 圖層與 draw order

由後到前：

| 順序 | 圖層 ID | 內容 | 來源 |
| ---: | --- | --- | --- |
| 0 | `bg` | 深藍背景 | 第 1 幀背景（或純色 + 漸層） |
| 1 | `hair_back` | 後髮 | 第 1 幀 + 補繪 |
| 2 | `body` | 肩、頸、鎖骨、衣服 | 第 1 幀 |
| 3 | `necklace` | 項鏈與墜飾 | 第 1 幀（可獨立微動） |
| 4 | `face_base` | 臉、鼻、嘴、眉 | 第 1 幀（身份鎖定） |
| 5 | `eye_sockets` | 眼窩、鞏膜 | 第 1 幀 |
| 6 | `iris_L/R` | 虹膜、瞳孔、高光 | 第 1 幀 |
| 7 | `eyelids` | 上／下眼皮、睫毛 | 由第 1／4／5 幀輔助建立 |
| 8 | `hair_side_L/R` | 左右臉側髮絲 | 第 1 幀 + 補繪 |
| 9 | `bangs` | 前額瀏海 | 第 1 幀 + 補繪 |
| 10 | `hair_long_L/R` | 左右外層長髮 | 第 1 幀 + 補繪 |
| 11 | `hair_shoulder` | 肩部髮尾 | 第 1 幀 + 補繪 |
| 12 | `earrings` | 左右耳環 | 第 1 幀 + 補繪 |

**遮擋關係**：`hair_*` 必須在臉與身體之上；`bangs` 在臉之上但在部分長髮之下。
`earrings` 在臉與側髮之間，依原始圖的實際層次決定。

## 2.5 素材生產（Stage 2）

這是整個專案最耗時、也最不可自動化的部分。步驟：

1. **選定乾淨底圖**：以 `frame_01.png` 為唯一身份底圖。
2. **臉部鎖定**：裁出臉部（含眼、鼻、嘴、眉），作為不可變形的 `face_base`。
3. **眼睛拆解**：從第 1 幀取鞏膜、虹膜、高光；從第 4／5 幀取眼皮與睫毛參考。
4. **髮絲分割**：為七組髮束建立 alpha matte。可使用手動遮罩或分割模型。
5. **補繪遮擋區**：當髮絲移開時，原本被遮住的臉／肩／背景需要 clean plate。這是 inpainting 的主要工作。
6. **飾物拆解**：耳環、項鏈各自去背，記錄附著點。
7. **對齊與縮放**：所有圖層統一至 1080² 座標系；04／05 的 1254² 素材需先對齊。
8. **登記**：每個生成物放入 `assets/generated/<version>/`，在清冊記錄來源與工具。

> [!IMPORTANT]
> 若沒有可靠的補繪，寧可限制髮絲位移幅度，也不要讓破洞曝光。
> 品質優先於動作幅度。

## 2.6 網格與權重

每組髮束建立一條（或數條）帶狀網格：

```text
頂點沿髮束中線排列，橫向 3–5 列。
每個頂點有：
  - position (x, y)
  - restPosition
  - rootWeight: 0（根）→ 1（尾）
  - phase: 每束不同
  - parent: 可選，支援階層
```

變形：

```text
displacement(vertex, t) =
    windEnvelope(t)
  * amplitude
  * rootWeight
  * [ sin(2π f t + phase) + noise(t, phase) ]
```

再以彈簧阻尼平滑：

```text
v += (target - current) * stiffness * dt
v *= exp(-damping * dt)
current += v * dt
```

限制：

- `rootWeight` 在根點必須為 0。
- 最大位移依髮束長度縮放。
- 相鄰頂點位移需平滑，避免網格撕裂。
- 不使用物理引擎，避免不可預測與效能負擔。

## 2.7 眨眼實作

兩種可行方案：

### 方案 A：眼皮圖層 + 遮罩（建議）

- 將上眼皮與睫毛做成獨立圖層。
- 以 `eyeOpen ∈ [0,1]` 控制眼皮的垂直位置與形狀。
- 眼窩與虹膜固定在底層；眼皮下降時自然遮住虹膜。
- 好處：可控、可與第 4／5 幀對齊、容易除錯。
- 難點：需要高品質的眼皮與睫毛素材。

### 方案 B：臉部局部 UV 變形

- 對眼睛周圍的網格做垂直壓縮。
- 好處：不需拆圖層。
- 難點：容易出現橡皮感，且會影響眼窩與眉毛；不建議作為主要方案。

**建議**：方案 A。若素材不足，先做方案 B 的受限版本，並在文件中標示為暫定。

## 2.8 狀態機

```text
IDLE ──(t=230)──▶ WIND_BUILD ──(t=630)──▶ BLINK
  ▲                                        │
  │                                        ▼
  └──(t=1890)── SETTLE ◀──(t=1020)── GUST_PEAK
```

- 風與眨眼是兩個獨立通道：眨眼可在任何風力下發生。
- `SETTLE` 必須在 1890–2300 ms 內把風力與耳環速度收斂到 0。
- 進入 `IDLE` 時，所有變形必須回到 rest pose，且與第 1 幀一致。

## 2.9 效能預算

| 項目 | 預算 |
| --- | --- |
| 首次可互動 | < 2.5 s（4G，快取冷啟動） |
| 影像傳輸 | < 2 MB（十幀 + 圖層） |
| 材質記憶體 | < 64 MB |
| draw calls | < 40 |
| 幀率 | ≥ 55 fps（2020 年中階 Android） |
| 長任務 | 無 > 50 ms |
| 解析度上限 | 1080² 材質；DPR 上限 2 |

策略：

- 只解碼當前與下一幀需要的高解析材質；低解析度變體用於預覽。
- 圖層以 atlas 合併，減少 texture switch。
- 風力計算在 GPU shader 或預計算頂點位移，避免每幀 CPU 重算大量頂點。
- 分頁隱藏時停止渲染。
- 尊重 reduced motion，直接顯示第 1 幀。

## 2.10 可及性

- Canvas 必須有 `role="img"` 與 `aria-label`，描述角色與動態。
- 若未來加入控制項，必須可用鍵盤操作並有可見焦點。
- 不得以閃爍或快速色變造成不適；目前無此類效果。
- `prefers-reduced-motion` 必須在第一幀就生效，不能先播再停。

## 2.11 測試策略

| 層級 | 工具 | 內容 |
| --- | --- | --- |
| 型別 | `tsc --noEmit` | 所有模組 |
| 單元 | Vitest（建議新增） | 時間軸取樣、風力公式、blink 狀態機 |
| 視覺 | Playwright（建議新增） | `?pose=N` 截圖比對；循環點一致性 |
| 效能 | Lighthouse / DevTools | LCP、長任務、fps |
| 人工 | 錄影 | 眨眼、穿模、殘影 |

目前只有型別與建置檢查；Stage 3 應補上視覺回歸。

## 2.12 遷移步驟

1. 保留 `CharacterStage` 的外殼與 URL 參數。
2. 新增 `src/render/renderer.ts`，先讓它畫單張第 1 幀，替換 Canvas 2D player。
3. 加入圖層 container，確認 draw order 與原圖一致。
4. 逐束加入 mesh 與風力，先用 `?wind=` 手動測試。
5. 加入眨眼圖層與狀態機。
6. 以 `?pose=N` 與靜態參考比對，修正遮罩與補繪。
7. 移除舊的交叉淡入路徑，更新文件與測試。
8. 保留 Stage 1 的程式作為 `legacy/` 或直接刪除，依 ADR 決定。

## 2.13 風險

| 風險 | 機率 | 影響 | 緩解 |
| --- | --- | --- | --- |
| 補繪品質不足 | 高 | 髮絲不能大幅移動 | 限制位移；先用小幅度上線 |
| 圖層分割不乾淨 | 高 | 邊緣出現白邊／黑邊 | 羽化 alpha、以第 1 幀線稿修邊 |
| WebGL 在低階裝置不穩 | 中 | 黑屏或掉幀 | 提供 Canvas 2D fallback |
| 依賴體積增加 | 中 | 首屏變慢 | 只引入 Pixi 必要模組；量測 |
| 代理缺乏視覺判斷 | 高 | 產出「能跑但不好看」 | 提供截圖、量化驗收、人工复核 |
| 角色權利變更 | 低 | 網站需下架 | 保持素材可快速移除的結構 |

---

## 3. 名詞對照

| 名稱 | 在本專案的意思 |
| --- | --- |
| Stage 1 | 目前部署的交叉淡入版本 |
| Stage 2 | 素材分層與補繪 |
| Stage 3 | 網格 rig 與風力 |
| Stage 4 | 眨眼與品質調校 |
| Clean plate | 移除前景後的補繪底圖 |
| Rest pose | 第 1 幀的靜止姿態 |
| Identity lock | 臉部幾何不隨動畫改變 |

---

## 4. 相關文件

- 動畫行為與驗收：[03 動畫規格](03-animation-spec.md)
- 素材來源與瑕疵：[02 素材清冊](02-asset-inventory.md)
- 操作與部署：[05 開發指南](05-development.md)
- 代理工作順序：[06 Codex 交接](06-codex-handoff.md)
- 技術決策理由：[08 決策紀錄](08-decisions.md)