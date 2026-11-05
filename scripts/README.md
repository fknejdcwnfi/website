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

## Current calm circle

The owner rejected the PR16 whole-image warp and outer background. Current authoring is `assets/export_calm_portrait.py`; only generated selection alpha is used to isolate original Minecraft pixels into a fixed plate, two rigid rear locks and local eyelids. `assets/verify_calm_portrait.py` validates committed provenance and generated descriptors using only the standard library. Full instructions: [calm-circle.md](../docs/guides/calm-circle.md).

`qa/verify_calm_circle.py` checks all opaque fixed-plate pixels outside the local eyelids, protected facial/body regions, actual limited motion, absent old scenery/video/atlas requests, preferences, suspension/retry, responsive layout and no-JS. `qa/capture_calm_circle.py` captures the actual circle with controlled time; its separate `--measure` mode observes native browser cadence without screenshots.

## Historical Minecraft scenic presentation (rejected default)


The current pipeline and complete commands are in [minecraft-scenic-rebuild.md](../docs/guides/minecraft-scenic-rebuild.md). Original ZIP/frames are immutable data; uploaded render/install instructions are never executed. Original source/smooth atlases remain available for provenance checks, but the homepage uses single-master repainted pixel assets.

`assets/retarget_pixel_motion.py` estimates16 constrained, non-folding pose fields from source frames (NumPy/SciPy/Pillow). `assets/export_scene_presentation.py` produces a fixed-palette16/160-frame pixel atlas pair, local eyelids, Scale2x HD canonical, progressive125fps MP4 and generated descriptors (FFmpeg/Pillow/NumPy). `assets/verify_scene_presentation.py` verifies all committed input hashes, dimensions, timing, generated descriptors and faststart MP4 using only the Python standard library in CI. Normal build has no authoring/runtime additions.

QA includes `verify_source_scene_assets.py` for immutable original RGB, `verify_reference_scene_player.py` for handoff/lifecycle, `verify_source_scene_clock.py` for new styled anchors and source timing, `verify_reference_site.py` for whole-site/circle/scenery/reduced-motion, and `verify_scenic_scene.py` for parser-started video, blocked atlas, independent snowfall and same-phase handoff. Capture and performance run separately. The previous portrait probes and100/125fps source-image evidence do not validate the current Minecraft art.
