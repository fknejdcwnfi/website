# 工具入口

從倉庫根目錄執行npm指令，Node版本見 `.nvmrc`。

| 目錄 | 用途 | 指令 |
| --- | --- | --- |
| `assets/` | 像素素材匯出、來源雜湊與格式驗證 | `npm run assets:check`、`npm run assets:verify`；匯出用下方Python工具 |
| `tests/` | 行為、型別邊界與個人化內容單元測試 | `npm test` |
| `qa/` | Playwright網站／肖像驗證、真實截幀與效能量測 | 見下方 |
| `deploy/` | 明確要求時的gh-pages手動備援 | `npm run deploy` |

```bash
python3 scripts/qa/verify_personal_site.py --url http://127.0.0.1:4178/website/
python3 scripts/qa/verify_portrait_browser.py --url http://127.0.0.1:5173/
python3 scripts/qa/capture_portrait.py --url http://127.0.0.1:4178/website/
python3 scripts/qa/measure_portrait.py --help
python3 scripts/assets/export_portrait.py --help
```

瀏覽器工具需要Python的Playwright、Pillow及Chromium；預設執行檔 `/usr/bin/chromium`；capture／measure／export工具可用 `--chromium`改寫。網站檢查、截幀與效能使用 `npm run build`後的 `npm run preview -- --port 4178`。肖像驗證還會直接probe TypeScript源碼，另以 `npm run dev -- --port 5173`提供dev網址。效能量測獨立執行，避免其他瀏覽器工作干擾。

正常發佈為PR檢查成功後合併main，再由既有GitHub Actions部署；不以手動備援繞過審查。指定時間截幀與完整24秒20 Hz GIF只用於動作檢視，不等於實體顯示器FPS。詳見 [開發指南](../docs/guides/development.md)。

## 參考版面與髮束物理重構

`qa/verify_raster_cache.py` 將可達跨度快取與原完整field逐像素比較，預設dev5173，輸出 `artifacts/reference-rebuild/raster-cache.json`；可用 `--url`／`--output` 指定位置。其餘本輪QA、截圖與同環境production效能命令見[重構指南](../docs/guides/reference-rebuild.md)。舊證據不覆寫，效能量測與其他瀏覽器工作序列執行。

## 影片驅動的獨立髮束

`assets/export_baked_portrait.py`從同一source算法無損輸出三尺寸atlas與binding、source/input/output SHA清冊；`assets:verify`檢查過期bake。`qa/verify_layered_portrait.py`是目前正式角色驗收，舊field probes只供archive。`qa/measure_portrait_startup.py`把冷啟動與穩態FPS分開；`qa/capture_portrait_video.py`從真實CSS圓形截圖編碼60fps審查影片，編碼率不代表實體顯示器FPS。完整命令／條件見[影片重建指南](../docs/guides/video-layered-rebuild.md)。

## New source-controlled reference scene

The current homepage uses `src/features/referenceScene/` and the complete owner-supplied project in `reference-projects/fuji-wind/`. `assets:verify` now checks ZIP CRC, every extracted original byte, source timing and committed atlas dependencies with Python's standard library. It never executes the uploaded `render.py`.

Offline derivation (`derive_reference_motion.py`) requires FFmpeg, NumPy and Pillow; pixel export (`export_source_scene.py`) calls offline-only `src/authoring/referenceScene/sourcePixels.ts` at native358×267, preserving all255 original colors, using local Vite, Playwright/Chromium and Pillow for lossless indexed PNG encoding. These are authoring tools, not browser/runtime dependencies and not required by a normal build. Do not install or execute ZIP instructions automatically. See `docs/guides/reference-gif-rebuild.md` for commands and the distinction between16 original frames and160 estimated samples.

The current motion export samples125fps (160×8ms), preserving the original1280ms loop. Every tenth PNG is copied byte-for-byte from an original80ms anchor. Eye protection transports one source eye shape by the source head's measured local translation, with a feathered skin edge; it does not dissolve two eye outlines or generate a separate blink schedule. Blink states remain those of the original12.5fps source. `--review artifacts/crisp-circle/source-analysis` writes the current report and native-resolution contact sheet without overwriting the previous100fps evidence. Encoded sample rate is not measured screen refresh or a claim that the source contained125fps motion.

QA: `verify_source_scene_assets.py`, `verify_source_scene_clock.py`, `verify_reference_scene_player.py`, `verify_reference_site.py`, `capture_reference_scene.py` and `measure_reference_scene.py`. The previous portrait probes are historical and do not validate the new homepage's source fidelity.
