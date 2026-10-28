# 可選的 GitHub Actions workflow

這兩個檔案是**預備用**的 CI／部署設定，刻意放在 `.github/workflows/` 之外。

## 為什麼不直接啟用

目前的 GitHub Personal Access Token 具備 `repo` scope，但**沒有 `workflow` scope**。
GitHub 會拒絕任何新增或修改 `.github/workflows/**` 的推送：

```text
refusing to allow a Personal Access Token to create or update workflow
`.github/workflows/deploy.yml` without `workflow` scope
```

因此目前的正式部署方式是 **`gh-pages` 分支**（見根目錄 README 與
[docs/05-development.md](../../docs/05-development.md#部署)）：

```bash
npm run deploy
```

## 何時可以啟用

只有在你願意為 token 增加 `workflow` scope，或改用 GitHub 網頁介面建立 workflow 時。

### 方式 A：更新 token 後移回

1. 在 GitHub → Settings → Developer settings → Personal access tokens 中，
   為 token 加上 `workflow` scope（或建立一顆有 `repo` + `workflow` 的新 token）。
2. 將檔案搬回：

   ```bash
   mkdir -p .github/workflows
   git mv deploy/github-actions/deploy.yml .github/workflows/deploy.yml
   git mv deploy/github-actions/ci.yml .github/workflows/ci.yml
   ```

3. 到 GitHub → Settings → Pages，將 **Source** 改為 **GitHub Actions**。
4. 推送 `main`，確認 Actions 成功。

### 方式 B：用 GitHub 網頁介面建立

1. 在 GitHub 網頁開啟 **Add file → Create new file**。
2. 路徑填 `.github/workflows/deploy.yml`，貼上 `deploy.yml` 的內容。
3. 同樣建立 `ci.yml`。
4. 將 Pages Source 改為 **GitHub Actions**。

## 啟用後的差異

| 項目 | gh-pages 分支（目前） | GitHub Actions（可選） |
| --- | --- | --- |
| 觸發方式 | 手動 `npm run deploy` | 推送 `main` 自動 |
| Token 需求 | `repo` | `repo` + `workflow` |
| Pages Source | Deploy from a branch → `gh-pages` | GitHub Actions |
| 建置紀錄 | 本機 | Actions 頁面 |
| 適合 | 目前權限、單人維護 | 長期自動化、PR 檢查 |

切換後請更新 `docs/05-development.md`、`docs/08-decisions.md` 與 `CHANGELOG.md`。
不要同時讓兩個機制部署同一個網站，以免互相覆蓋。