# 富士山風雪動畫 — 可編輯原始素材與 Python 專案

這個專案是從你提供的 **GIF 成品**反向整理的，不是生成模型的內部專案或繪畫圖層源文件。

## 包含的檔案

- `original.gif`：**完全保留你上傳的原始 GIF**。
- `frames/frame_000.png` 至 `frame_015.png`：逐幀提取的高保真 PNG，方便在 Photoshop / GIMP / Krita 手動修改。
- `render.py`：Python 重新合成、放大、FPS 取樣和可選光流補幀的程式。
- `metadata.json`：尺寸、幀數和每幀原始時長。
- `requirements.txt`：執行程式所需的 Python 套件。

## 原動畫資訊

- 分辨率：**358 × 267**
- 影格數：**16**
- 每影格：**80 ms**
- 原始更新率：約 **12.5 FPS**
- 總循環時長：約 **1.28 秒**

## Windows PowerShell 安裝

```powershell
cd "富士山風雪動畫_可編輯源文件"
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## 合成原本影格動畫

```powershell
python render.py --fps 12.5 --format gif
```

## 嘗試補幀到 25 FPS + 2 倍放大

```powershell
python render.py --fps 25 --scale 2 --interpolate --format gif
```

## 匯出 30 FPS MP4

```powershell
python render.py --fps 30 --scale 2 --interpolate --format mp4
```

## 重要限制

1. PNG 是從 GIF 解碼的像素影格，**不能重建原模型內部生成程式**、人物與頭髮的獨立分層、原始作畫筆觸或模型參數。
2. 以 `LANCZOS` 放大只是插值，**不會創造真實的高清細節**。
3. 光流補幀提供平滑的中間影格，但大幅度髮絲飄動可能導致重影或變形，也無法保證臉部完全不變。
4. 若要高品質重做「髮絲單向強風 + 眨眼 + 飄雪 + 富士山」，最佳方法是取得更高分辨率的原畫與獨立圖層後重新製作動畫。
5. 這個 Python 工程是**根據成品 GIF 新寫的可編輯重建程式**，不是當初圖片生成服務的內部源碼。

## 如何修改動作

可在 `frames` 資料夾逐張修改對應 PNG，保留檔名，再重新執行 `render.py`。直接修改時間安排可編輯 `metadata.json` 中的 `frame_durations_ms`。
