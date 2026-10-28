# 02 · 素材清冊

- **狀態**：十張關鍵姿態已就位；衍生檔可重建
- **最後更新**：2026-10-28
- **適用對象**：美術、前端、任何要修改或新增素材的人

---

## 1. 基本原則

1. **`assets/source/**` 是唯讀的真實來源。** 不得裁切、覆寫、重新編碼或原地改名。
2. **網站只載入衍生檔。** 所有給瀏覽器的圖片都放在 `public/assets/**`，由 `scripts/optimize_assets.py` 產生。
3. **衍生檔可丟棄。** 只要原始素材還在，執行 `npm run assets` 就能完整重建。
4. **新增素材必須登記。** 在本文補上來源、尺寸、授權與用途，否則視為未完成。
5. **不得用 AI 重新生成第 1 幀。** 第 1 幀是身份與構圖的唯一權威。

---

## 2. 目錄結構

```text
assets/source/
├── frames/
│   ├── frame_01.png        # 身份與構圖權威
│   ├── frame_02.png
│   ├── ...
│   └── frame_10.png        # 與 frame_01 位元組完全相同
├── original_reference.jpg  # 最初的單張角色參考
└── preview/
    ├── 10_frame_contact_sheet.jpg
    └── 10_frame_preview.gif
```

`public/assets/` 由腳本產生，內容如下：

```text
public/assets/
├── frames/frame_01.webp … frame_10.webp
└── manifest.json
```

---

## 3. 關鍵姿態清冊

| 幀 | 來源檔案 | 尺寸 | 原始大小 | 風力 | 眼睛 | 動作摘要 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 01 | `frames/frame_01.png` | 1080×1080 | 1.09 MB | 0.00 | 1.00 | 完全靜止，身份基準 |
| 02 | `frames/frame_02.png` | 1080×1080 | 1.46 MB | 0.18 | 1.00 | 右側外層髮尾初動 |
| 03 | `frames/frame_03.png` | 1080×1080 | 1.49 MB | 0.45 | 1.00 | 右側長髮分束流動 |
| 04 | `frames/frame_04.png` | **1254×1254** | 2.09 MB | 0.65 | 0.45 | 半閉眼（Refined 高清版） |
| 05 | `frames/frame_05.png` | **1254×1254** | 2.06 MB | 0.70 | 0.00 | 完全閉眼（Refined 高清版） |
| 06 | `frames/frame_06.png` | 1080×1080 | 1.51 MB | 0.75 | 1.00 | 重新睜眼 |
| 07 | `frames/frame_07.png` | 1080×1080 | 1.57 MB | 0.90 | 1.00 | 陣風高峰，多束獨立擺動 |
| 08 | `frames/frame_08.png` | 1080×1080 | 1.46 MB | 0.50 | 1.00 | 風向改變，髮束回彈 |
| 09 | `frames/frame_09.png` | 1080×1080 | 1.43 MB | 0.20 | 1.00 | 風勢減弱，逐漸落回 |
| 10 | `frames/frame_10.png` | 1080×1080 | 1.09 MB | 0.00 | 1.00 | 與第 1 幀完全相同，供循環 |

**完整性驗證**：

```text
frame_01.png  SHA-256 346921fcfe6afe8224f5479a61ed2c809f2a1f46ba497255a08ef69740b21790
frame_10.png  SHA-256 346921fcfe6afe8224f5479a61ed2c809f2a1f46ba497255a08ef69740b21790
```

兩者位元組完全相同。這是循環無接縫的基礎；**任何重新生成都必須保持這一點**，或明確改為「第 10 幀是獨立姿態」。

### 視覺審核素材

| 檔案 | 尺寸 | 用途 |
| --- | --- | --- |
| `preview/10_frame_contact_sheet.jpg` | 1944×888 | 十幀並排比對，README 與文件引用 |
| `preview/10_frame_preview.gif` | 640×640 | 粗略動態預覽，**不是**成品品質 |

---

## 4. 權威順序

當兩張圖對同一細節有衝突時：

1. **`frame_01.png`** — 臉型、五官、瀏海輪廓、飾物位置、鏡頭構圖的唯一權威。
2. **`original_reference.jpg`** — 與第 1 幀同源，用於理解原始意圖；若與第 1 幀有差異，以第 1 幀為準。
3. **`frame_02`–`frame_09`** — 只提供「該時刻的頭髮／眼皮姿態」參考，**不是**身份權威。
4. **`frame_10`** — 與第 1 幀相同，無額外資訊。
5. **`preview/*`** — 僅供人眼快速瀏覽，不作為像素依據。

---

## 5. 已知瑕疵與限制

這些是素材本身的性質，不是程式 bug。Stage 2 必須處理，Stage 1 只能標示。

| 編號 | 現象 | 影響 | 處理方向 |
| --- | --- | --- | --- |
| A1 | 十幀由獨立生成而來，臉部幾何有細微差異 | 交叉淡入時五官可能「滑動」 | 以第 1 幀為唯一臉部底圖；其他幀只用於頭髮／眼皮參考 |
| A2 | 04／05 為 1254²，其餘 1080² | 縮放後構圖有極小偏移 | 衍生檔統一為 1080²；必要時做對齊校正 |
| A3 | 髮絲走向與遮擋關係每幀不同 | 直接輪播會閃爍、穿模 | 分層 + 遮罩 + clean plate，不可逐幀播放 |
| A4 | 耳環、項鏈位置略有漂移 | 快速切換時飾物跳動 | 飾物抽為獨立圖層，固定附著點 |
| A5 | 部分髮尾在畫面邊緣被裁切 | 大幅變形時可能露邊 | 變形幅度受限；必要時補繪邊緣 |
| A6 | 沒有透明通道（全部 RGB） | 無法直接去背疊層 | 需產生 alpha matte／遮罩 |
| A7 | 沒有乾淨的背景與髮後區域 | 頭髮移開後會露出破洞 | inpainting／clean plate 生產 |
| A8 | AI 生成的線條粗細不完全一致 | 疊合時可能出現雙線 | 以第 1 幀線稿為準，局部重繪 |

> [!WARNING]
> 不要用「模糊、對齊、縮放」掩蓋 A1–A8。這些手法在單幀截圖看不明顯，但一動就會暴露。
> 正確做法是建立分層與乾淨底圖，讓每個像素都有明確歸屬。

---

## 6. 衍生檔

`scripts/optimize_assets.py` 的行為：

| 設定 | 值 | 理由 |
| --- | --- | --- |
| 最長邊 | 1080 px | 對應 860 CSS px 舞臺在 DPR 2 下的需求 |
| 格式 | WebP | 相較 PNG 大幅縮小，現代瀏覽器全支援 |
| 品質 | 86 | 在線條清晰度與檔案大小間平衡 |
| method | 6 | 較慢但壓縮率較好；只在建置前執行 |
| 輸出 | `public/assets/frames/frame_XX.webp` | 由 Vite 原樣複製到 `dist/` |

十幀合計約 **1.4 MB**（原始 PNG 約 16.9 MB）。單幀最大 169 KB。

`manifest.json` 記錄：

- 衍生檔路徑與來源路徑
- 輸出寬高
- 位元組數
- 衍生檔 SHA-256

它同時是「衍生檔是否與來源同步」的檢查依據。若你修改了原始素材但沒有重跑管線，manifest 會與實際檔案不一致。

### 重建指令

```bash
python3 -m pip install Pillow
npm run assets
npm run assets:check
```

若輸入不是正方形、或少於／多於十張，腳本會失敗並指出原因。

---

## 7. 原始投放結構 → 目前結構

最初收到的資料夾是 `vermouth_10frame_animation_refined/`，內含 Windows 的 `:Zone.Identifier` 附加檔案。重構後的對應如下：

| 原始路徑 | 目前路徑 | 處理 |
| --- | --- | --- |
| `frames/frame_01.png` … `frame_10.png` | `assets/source/frames/` | 原樣搬移 |
| `original_reference.jpg` | `assets/source/original_reference.jpg` | 原樣搬移 |
| `10_frame_contact_sheet.jpg` | `assets/source/preview/` | 原樣搬移 |
| `10_frame_preview.gif` | `assets/source/preview/` | 原樣搬移 |
| `10_frame_prompts.md` | `docs/reference/10_frame_prompts.md` | 原樣保留 |
| `codex_prompt.md` | `docs/reference/codex_prompt.md` | 原樣保留 |
| `*:Zone.Identifier` | — | 刪除（Windows 下載標記，無內容價值） |

原始文件沒有改寫；`docs/reference/` 是凍結區。

---

## 8. 若要新增素材

1. 先確認是否真的需要新素材；能用現有幀與補繪解決就不要新增。
2. 原始檔放入 `assets/source/` 的適當子目錄，**不要**放進 `public/`。
3. 在本文新增一列，記錄：檔名、尺寸、來源、授權、用途、是否為身份權威。
4. 若是新的關鍵姿態，同步更新 `src/animation/keyPoses.ts` 與 [動畫規格](03-animation-spec.md)。
5. 若是分層素材（遮罩、眼皮、乾淨底圖），放到 `assets/generated/`，並在 manifest 或獨立清冊登記。
6. 重跑 `npm run assets` 與 `npm run build`。
7. 在 PR 說明中貼上視覺比對（before／after）。

---

## 9. 權利與使用範圍

- 角色「貝爾摩德（Vermouth）」出自《名偵探柯南》，權利屬於青山剛昌與相關權利方。
- 本專案素材為個人、非商業性質的粉絲創作／AI 輔助生成，僅供個人網站展示。
- **禁止**：商業使用、再散布、販售、用於模型訓練、移除浮水印或聲稱擁有角色權利。
- 若未來加入第三方素材（字型、筆刷、材質、音樂），必須在本文補上來源與授權，並確認與上述限制不衝突。
- 本倉庫的程式碼與文件不因包含角色圖像而取得任何角色授權。