# 貢獻指南

先讀[文件入口](docs/README.md)、[個人網站](docs/guides/personal-site.md)、[Living Portrait](docs/guides/living-portrait.md)及[參考風動](docs/guides/reference-wind.md)。這是fknejdcwnfi的完整Minecraft像素風個人網站，角色沿用透明無框原近景；個人內容與動畫各自維護。

## 開發與交付

```bash
npm ci
npm run dev
# 修改後執行
npm test
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
```

在任務分支完成修改與審查，建立PR；相關驗證與CI通過後依擁有者授權自動合併至 `main`，核對GitHub Actions／Pages。保留分支保護，不向main強制推送。清理分支前先確認已合併或內容相同，另保留必要備份，不能刪除有未合併工作的分支。`npm run deploy`僅是擁有者明確要求時的手動備援。

視覺變更需附實際首頁、手機、原圖／靜止／風動／閉眼對照及完整循環。新效能數字需附production環境、取樣時長與裝置／瀏覽器條件；密集截幀、模擬更新率或GIF編碼率不是實際螢幕FPS。詳見[開發及QA](docs/guides/development.md)。

## 修改範圍

- `src/app/`組合頁面；`src/features/profile/`管理個人化、靜態內容與網站UI。
- `src/features/portrait/`管理角色動畫及renderer；`src/archive/`只保留明確歷史模式。
- `scripts/assets/`、`scripts/qa/`、`scripts/tests/`及`scripts/deploy/`分別負責素材、驗證、單元與部署備援。
- `docs/guides/`記錄現行行為，`docs/archive/`保留歷史；新理由追加至[決策紀錄](docs/decisions.md)。
- 新生成母版與runtime需在[素材清冊](docs/guides/asset-inventory.md)登記來源、用途、尺寸、雜湊及限制。

`assets/source/**`及`docs/reference/**`唯讀，不覆寫、裁切、重新編碼或改名。維持同一canonical身份與原近景構圖；不以新生成臉輪播、整張圖平移／旋轉／縮放或無關場景冒充局部風動。legacy交叉淡入仍是暫定歷史預覽，不能描述成完成品。

帳號與遊戲資料只填使用者確認的公開資訊。未設定資料不顯示空卡片、無效導覽或假按鈕；不新增假履歷、假專案或沒有後端的送信表單。修改workflow需具備相應權限，不能停用CI／Pages以規避失敗。

## 提交與PR

使用Conventional Commits，例如 `feat: refine layered hair motion`、`fix: retain poster before first paint`、`docs: reorganize current guides`。一次提交集中一個目的，PR描述問題與實際結果、驗證及必要限制。

提交前確認建置與相關檢查通過、原始來源及凍結文件未變、視覺證據已更新、相對文件連結可用。不要提交 `node_modules/`、`dist/`、`*.tsbuildinfo`或未整理的暫存檔。

角色權利仍屬原權利方，使用範圍見[素材清冊](docs/guides/asset-inventory.md#9-權利與使用範圍)。
