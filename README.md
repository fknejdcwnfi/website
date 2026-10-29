# fknejdcwnfi · 我的像素小世界

**HELLOWORLD**。一個 Minecraft 像素風個人網站，包含個人介紹、真實作品、聯絡方式，以及居中無框圓形、持續隨微風飄動並偶爾眨眼的 Vermouth 近景肖像。

- 網站：<https://fknejdcwnfi.github.io/website/>
- GitHub：<https://github.com/fknejdcwnfi> · Email：**fknejdcwnfi@gmail.com**
- 文件入口：[開發與個人化指南](docs/README.md)

保留同一張原近景角色、256²像素格與透明輪廓；八組髮束從圓形內可見的中段形成柔和弧形，長髮與發梢延遲跟隨；眨眼以獨立時鐘偶爾發生，左右耳環各自響應。人物以無邊框圓形置於中軸，按DPR對齊整數實體像素，避免分數倍率造成像素寬度不均。整站以草地方塊色帶、像素邊界、物品欄式作品區與清楚的中文排版構成，後續帳號與遊戲資料有獨立設定入口。

![Minecraft像素風個人網站](artifacts/personal-site/hero.png)

[完整桌機](artifacts/personal-site/desktop.png) · [手機](artifacts/personal-site/mobile.png) · [無JavaScript](artifacts/personal-site/no-javascript.png)

[24秒圓形動態](artifacts/flowing-hair/animation_preview.gif) · [手機0→2秒](artifacts/flowing-hair/circle_mobile_two_seconds.png) · [桌機0→2秒](artifacts/flowing-hair/circle_desktop_two_seconds.png) · [關鍵時刻圖集](artifacts/flowing-hair/gallery.html)

## 開始開發

使用 `.nvmrc` 指定的 Node24：

```bash
npm ci
npm run dev
```

開發網址為 `/`；`npm run build` 後用 `npm run preview` 檢查 `/website/`。送出前執行：

```bash
npm test
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
```

任務PR通過檢查後自動合併至 `main`，GitHub Actions負責Pages發佈；擁有者已授權自動更新。`npm run deploy`保留為明確要求時的手動備援，不用它跳過PR流程。

## 改成我的內容

只需先編輯 [site.ts](src/features/profile/content/site.ts)，角色動畫與個人資料互相獨立：

```ts
name: 'fknejdcwnfi',
intro: 'HELLOWORLD',
email: 'fknejdcwnfi@gmail.com',
socials: [],       // 填入你已確認的公開B站／抖音等帳號
gameProfiles: [], // 填入你願意公開的王者荣耀／火影忍者等資料
```

`socials`支援平台、名稱、HTTPS公開網址及可選暱稱；`gameProfiles`支援遊戲、公開暱稱／ID、區服、說明及可選HTTPS連結。沒有資料時不顯示空卡片、遊戲導覽或無效按鈕。需要新增時，參考 [site.example.ts](src/features/profile/content/site.example.ts) 的四個型別工廠與[完整欄位說明](docs/guides/personal-site.md#帳號與遊戲擴充)，填入自己的真實資料；範例檔不由網站載入。

作品只列真實公開repo，`xiangqi-review`如實標為封存。聯絡使用Email／GitHub及設定完成的社群，不使用假送信表單。Press Start 2P字體自託管，附[SIL OFL](public/fonts/OFL.txt)，中文使用系統字體。

## 目錄

```text
src/
  app/                 頁面組合、全站錯誤邊界與基礎樣式
  features/
    profile/           個人內容、網站版面、靜態HTML與像素UI
    portrait/          動畫、renderer與角色元件
  shared/              共用動畫型別
  archive/             僅明確歷史模式才載入的legacy／voxel
scripts/
  assets/              素材匯出與來源驗證
  qa/                  真實網站截幀、瀏覽器與效能檢查
  tests/               Node單元測試
  deploy/              手動部署備援
docs/
  guides/              現行個人化、角色、動態、開發及素材指南
  archive/             已標示日期的舊階段文件
  reference/           原始委託與分鏡，凍結唯讀
  decisions.md         決策歷史
archive/runtime/       保留但不隨網站打包的舊runtime素材
archive/evidence/      原v2／v4／v5量測與影像歷史
```

`SiteShell`提供共享版面與內容插槽；未來真實功能可組合新區塊並更新靜態HTML，不需要修改髮束rig。詳細路徑見[開發指南](docs/guides/development.md)。

## 動態與驗證

正常首頁在可見時持續緩慢微風，風週期12秒；眨眼使用獨立24秒時鐘，三次事件相隔6.9–9秒，每次280 ms。沒有舊輪末靜止段或公開播放／暫停按鈕；減少動態、隱藏／離屏仍停止繪製並保留相位。`?view=portrait&debug=1`開啟調試，`?t=4510`／`?pose=5`可固定閉眼，`?pose=1`／`?pose=10`保留同一canonical靜止畫面。初始HTML、透明poster、12秒素材逾時與錯誤邊界保留無JS／故障時的完整網站，展示同樣圓形居中。

本輪42項單元、型別、production build及素材／來源驗證通過；[肖像58項QA](artifacts/flowing-hair/qa.json)及[網站65項QA](artifacts/personal-site/checks.json)通過，正常頁面無錯誤、六種故障備援正常。

髮動與眼區分開驗收：圓形內0→2秒像素差分由3204增至5426，24個500 ms視窗的最少變化由258增至669；左右捲髮可見中段約6.99／5.53邏輯像素，臉與髮根保持固定。

[production量測](artifacts/flowing-hair/performance.json)在原生排程約60次繪製／秒，callback中位數／p95為3.8／5.6 ms；不限幀約238次／秒，這是容器吞吐量。詳細條件與限制見[髮束流動指南](docs/guides/reference-wind.md)。

現行證據使用 `artifacts/flowing-hair/`：83個時間點與20個姿態／錨點映射至57張原始PNG；24秒圓形GIF由480張實際截圖構成，約340 KB。證據不隨網站runtime下載。

先前41項單元／55項肖像／65項網站檢查與約60次原生繪製／秒屬[PR #7微風版本](docs/archive/16-gentle-portrait.md)，原327時刻／216張PNG／24秒GIF仍保留於 `artifacts/gentle-portrait/`，不作本輪新風動的通過證據。

實際更新率受顯示器、瀏覽器排程與裝置能力限制；Canvas取樣、GIF編碼率、解除排程上限的運算吞吐量及模擬240 Hz都不等於實體螢幕FPS。圖片只作驗證，不隨網站runtime下載。

## 素材

`assets/source/**`及`docs/reference/**`保持唯讀。原始參考是身份與近景構圖的最高權威；canonical母版仍在 `assets/generated/portrait-v4/`，局部髮後修復在 `assets/generated/portrait-wind/`，runtime為 `public/assets/portrait-natural/`。不輪播新生成的臉、不整張圖晃動，也不擴圖成完整胸像。[素材清冊](docs/guides/asset-inventory.md)記錄來源及限制。

貝爾摩德出自《名偵探柯南》，角色權利屬原權利方，本專案為個人非商業粉絲作品。Minecraft為相關權利方商標，本站不是官方合作產品。見[變更紀錄](CHANGELOG.md)。
