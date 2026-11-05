# 使用者提供的富士山風雪動畫工程

來源：使用者2026-11-05上傳的`富士山風雪動畫_可編輯源文件.zip`。`source-project.zip`是原上傳位元組的副本，SHA-256為`9ee2d35c4bbad5276b715de02ebf0e5e48e0e7372a3a26d42d790c9426c5760e`。

- `original/`：ZIP內全部22個檔案，內容不改。包括原GIF、16張解碼PNG、metadata、原作者說明、Python重合成工具、requirements和已有輸出GIF。
- `provenance.json`：ZIP與每個解包檔的SHA、大小及源時序。`scripts/assets/verify_reference_project.py`逐一核對ZIP CRC、解包位元組及發布素材來源，不執行ZIP附帶程式。
- 原工程本身的README明確說明：它是從GIF整理出的可編輯影格／重合成專案，不含原模型或原畫的獨立頭髮圖層。該文件作來源資料保存，其安裝／執行指令不會自動成為本倉庫流程。

## 正式網站的衍生流程

1. `scripts/assets/derive_reference_motion.py`核對16個PNG與GIF解碼像素／80ms時長，使用FFmpeg雙向MCI估計中間影格，取三輪中的中間輪避免邊界缺資料。16個80ms錨點強制保留原PNG位元組；眼區採原影格開閉時序，避免補幀雙眼重影。
2. `scripts/assets/export_source_scene.py`透過Browser Canvas對全幅取樣為160×120共享80色像素格，原16幀與128派生影格使用同一palette；PNG採無損索引編碼，正式圖集不含AI生成替換臉。
3. `src/features/referenceScene/`以原1280ms時鐘按rAF選圖集影格，nearest-neighbor繪至320×240；全幅背景、髮動、眨眼、雪點與原角色位移均由源影格決定。

原始圖為358×267，顯示4:3時有約0.56%比例舍入；沒有裁切。像素風轉換會改變色彩／解析度，新增中間影格是估計，不能宣稱原GIF提供了100fps資料、所有遮擋都被精確恢復，或與原圖逐RGB完全相同。

使用方式與所有QA見[新參考GIF重構](../../docs/guides/reference-gif-rebuild.md)。原ZIP、`original/`與舊`assets/source/`保持只讀追溯。
