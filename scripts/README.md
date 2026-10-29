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
