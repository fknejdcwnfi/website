# 07 · QA 檢查表

> **目前 QA 入口（2026-10-28）**：預設像素舞台應依新契約檢查局部動態、4800 ms 循環、24 fps 節流、靜止生命週期、選項與 legacy 回歸。下列原圖臉部誤差、55–60 fps 與原圖分層項為舊路線專用，不得把未執行項目冒充通過。 目前有效規格見 [10 像素舞台](10-pixel-stage.md) 與 [ADR-014](08-decisions.md#adr-014--預設切換為-minecraft-風格像素動態-vermouth)。

- **狀態**：Stage 1 適用；Stage 2 以上需追加項目
- **最後更新**：2026-10-28
- **使用方式**：每次 PR 或發佈前逐項打勾；不適用者標 `N/A` 並寫理由

---

## 0. 發佈門檻（Release Gate）

以下任一項失敗，**不得發佈**：

- [ ] `npm ci` 成功
- [ ] `npm run typecheck` 成功
- [ ] `npm run build` 成功
- [ ] `npm run assets:check` 成功
- [ ] `npm run assets:verify` 成功
- [ ] 部署網址可存取，無 404
- [ ] 瀏覽器 console 無 error
- [ ] 1080² 與 390 px 寬的視覺檢查通過
- [ ] `prefers-reduced-motion` 行為正確
- [ ] 文件與程式碼一致

---

## 1. 建置與型別

- [ ] `npm ci` 無錯誤。
- [ ] `npm run typecheck` 無輸出（成功）。
- [ ] `npm run build` 產出 `dist/index.html`、JS、CSS、十張 WebP。
- [ ] `npm run assets:verify` 通過（manifest 雜湊、第 1/10 幀一致、必要靜態檔）。
- [ ] 建置產物中的資源路徑以 `/website/` 開頭（GitHub Pages）。
- [ ] 沒有 TypeScript `any` 或 `@ts-ignore` 新增。
- [ ] 沒有未使用的匯入或變數（`tsc` 會捕捉）。
- [ ] `package-lock.json` 有更新且已提交。

指令：

```bash
npm ci
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
grep -o '/website/[^"]*' dist/index.html | head
```

---

## 2. 資源與素材

- [ ] `frame_01.png` 與 `frame_10.png` 的 SHA-256 相同。
- [ ] `public/assets/manifest.json` 存在，十幀皆列出。
- [ ] 十張 WebP 皆可載入，無 404。
- [ ] 單幀檔案 < 250 KB；總計 < 2 MB。
- [ ] `og-image.webp` 存在且為 1200×630。
- [ ] `favicon.svg` 可載入。
- [ ] 沒有 `:Zone.Identifier`、`.DS_Store`、`Thumbs.db` 等雜物。
- [ ] `assets/source/**` 與上次提交相比沒有非預期變更。

指令：

```bash
sha256sum assets/source/frames/frame_01.png assets/source/frames/frame_10.png
npm run assets:check
find . -name '*:Zone.Identifier' -o -name '.DS_Store' -o -name 'Thumbs.db'
du -sh public/assets/frames
```

---

## 3. 靜態視覺

- [ ] 舞臺為正方形，角色完整可見，無裁切異常。
- [ ] 背景為深藍近黑，無色塊或漸層斷層。
- [ ] 舞臺圓角、陰影、光暈自然，無溢出。
- [ ] 沒有可見文字、按鈕、導航、footer 或浮水印。
- [ ] 與 `frame_01.png` 相比，`?pose=1` 的構圖一致。
- [ ] 第 1 幀與第 10 幀的靜態畫面完全相同。
- [ ] 桌面 1200×1000 與手機 390×844 皆美觀。

截圖：

```text
桌面：1200×1000，DPR 1
手機：390×844，DPR 2
狀態：一般、?debug=1、?pose=1、?pose=5、?pose=7
```

---

## 4. 動態行為

- [ ] 完整循環 2300 ms，無可見跳接。
- [ ] 第 10 幀到第 1 幀無抽動。
- [ ] 起風（0–460 ms）自然，不是突然抽動。
- [ ] 眨眼（630–850 ms）總長 220 ms，無頭部縮放。
- [ ] 陣風高峰（1020 ms）髮束有層次，不是整片平移。
- [ ] 衰減（1570–1890 ms）有阻尼，不是直接停住。
- [ ] 耳環有輕微擺動，附著點不脫離。
- [ ] 項鏈與身體幾乎固定。
- [ ] 無閃爍、殘影、穿模、破洞。
- [ ] `?pose=N` 可凍結每一幀，畫面正確。
- [ ] `?debug=1` 的 `t`、`wind`、`eyeOpen` 與規格一致。

Stage 1 已知限制：交叉淡入可能造成短暫殘影；這是預期，不視為新增 bug。
若殘影比基線更嚴重，視為回歸。

---

## 5. 響應式與裝置

- [ ] 390×844（iPhone 12 級）完整可見，無水平滾動。
- [ ] 360×800（Android 小機）完整可見。
- [ ] 768×1024（平板）置中，比例正確。
- [ ] 1440×900（桌機）不過大、不模糊。
- [ ] 橫向手機（844×390）仍可使用。
- [ ] 安全區（瀏海、底部手勢區）沒有遮擋。
- [ ] 縮放瀏覽器（80%–200%）不破版。
- [ ] DPR 2 下線條清晰，無模糊。

---

## 6. 可及性

- [ ] Canvas 有 `role="img"` 與有意義的 `aria-label`。
- [ ] 頁面有 `<title>` 與 `description`。
- [ ] 沒有自動播放的聲音。
- [ ] `prefers-reduced-motion: reduce` 時只顯示靜止第 1 幀。
- [ ] 減少動態偏好切換時，不需重新載入即可生效。
- [ ] 對比度：背景與任何可見元素有足夠對比（目前無文字）。
- [ ] 鍵盤不會困在頁面中（無互動元素）。
- [ ] 縮放 200% 不丟失內容。

---

## 7. 效能

- [ ] 首次載入（4G 模擬）< 2.5 s 可看到角色。
- [ ] 十幀預載完成後，播放無解碼卡頓。
- [ ] 完整循環 ≥ 55 fps（中階裝置模擬）。
- [ ] 無 > 50 ms 長任務。
- [ ] 分頁隱藏時 rAF 停止（可在 DevTools Performance 觀察）。
- [ ] 回到前景時相位大致延續，不回到第 1 幀。
- [ ] 記憶體沒有持續增長（播放 2 分鐘）。
- [ ] Canvas backing store 不超過 CSS 尺寸 × 2。

---

## 8. 部署

- [ ] `.github/workflows/deploy.yml` 與 `ci.yml` 存在且未被停用。
- [ ] PR 的 `CI` workflow 成功。
- [ ] 合併／推送 `main` 後的 `Deploy to GitHub Pages` workflow 成功。
- [ ] Pages Source 為 **GitHub Actions**。
- [ ] `https://fknejdcwnfi.github.io/website/` 回傳 200。
- [ ] 頁面資源（JS、CSS、WebP、favicon、OG）皆 200。
- [ ] 直接開啟深層 URL（`?debug=1`）正常。
- [ ] 手機網路下載正常。
- [ ] 沒有 mixed content 或 CORS 錯誤。
- [ ] `og:title`、`og:description`、`og:image` 正確。
- [ ] 若使用 `gh-pages` 備援，Pages Source 已同步切換，且未同時啟用兩套部署。

指令：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://fknejdcwnfi.github.io/website/
curl -sS -o /dev/null -w '%{http_code}\n' https://fknejdcwnfi.github.io/website/assets/frames/frame_01.webp
curl -sS https://api.github.com/repos/fknejdcwnfi/website/actions/runs?per_page=3 \
  | python3 -c "import sys,json;[print(r['name'],r['status'],r['conclusion']) for r in json.load(sys.stdin)['workflow_runs']]"
git ls-remote --heads origin gh-pages   # 只有使用備援時才需要
```

---

## 9. 文件

- [ ] `README.md` 的指令可照抄執行。
- [ ] 文件內的相對連結無 404。
- [ ] `docs/03` 的時間軸與 `keyPoses.ts` 一致。
- [ ] `docs/06` 的工作順序仍適用。
- [ ] `CHANGELOG.md` 已記錄本次變更。
- [ ] `docs/reference/**` 沒有被修改。
- [ ] 新增的素材已登記在 `docs/02`。
- [ ] 新增的 URL 參數已寫入 `docs/03` 與 `docs/05`。

---

## 10. 代理特有的檢查

若變更由 Codex Cloud 或其他代理完成，額外確認：

- [ ] PR 描述包含動機、範圍、驗收證據、已知限制。
- [ ] 沒有把「未驗證」寫成「已完成」。
- [ ] 沒有覆蓋 `assets/source/**`。
- [ ] 沒有引入未說明的依賴。
- [ ] 沒有加入可見 UI 或互動。
- [ ] 沒有用整圖 transform 假裝局部動畫。
- [ ] 截圖或錄影存在，或明確說明無法產生的原因。
- [ ] 若停手，附上 `STOPPED` 回報與待決問題。

---

## 11. 快速檢查腳本（可選）

```bash
#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run typecheck
npm run build
npm run assets:check

test -f dist/index.html
test "$(find dist/assets/frames -name '*.webp' | wc -l)" -eq 10
grep -q '/website/' dist/index.html

echo "OK: build, assets, and base path look sane"
```

> 這個腳本只驗證工程層面；視覺與動態仍需人工或瀏覽器自動化檢查。