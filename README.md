# fknejdcwnfi · 我的像素小世界

**HELLOWORLD**。這是 fknejdcwnfi 的個人網站，首頁是依使用者提供的富士山風雪GIF工程重構的原生像素圓形場景，保留原飄髮、眨眼、耳飾、富士山、櫻花與落日構圖。

- 網站：<https://fknejdcwnfi.github.io/website/>
- GitHub：<https://github.com/fknejdcwnfi> · Email：**fknejdcwnfi@gmail.com**
- [原始ZIP與全量工程](reference-projects/fuji-wind/) · [重構／復現指南](docs/guides/reference-gif-rebuild.md)

原GIF16幀、每幀80ms、周期1280ms。本版移除先前160×120降採樣，圖集與Canvas均保留358×267原尺寸和全部255種源色，原16錨幀與原PNG逐像素一致。展示改為無描邊圓形，最大534px，nearest顯示並按DPR對齊像素；只裁展示窗口，不改原圖。這是保留源風格的Minecraft-inspired二維像素呈現。

預設160個8ms運動補償樣本（125樣本／秒），眼形隨源頭部位移而非整塊固定；源眨眼時序不變。中間影格是估計，實際顯示率取決於裝置，不冒稱源GIF125fps。`?motion=original`提供原16幀對照。網站內容、搜尋、真實專案、聯絡及無JavaScript圓形後備保留，歷史角色僅在`?view=portrait`等明確入口載入。

![原生像素圓形網站](artifacts/crisp-circle/site/desktop.png)

[手機](artifacts/crisp-circle/site/mobile.png) · [實際圓形動畫預覽](artifacts/crisp-circle/preview/animation.mp4) · [清晰度前後對比](artifacts/crisp-circle/clarity-comparison.png) · [原生像素圓形](artifacts/crisp-circle/site/circle-native-grid.png) · [不可變來源](reference-projects/fuji-wind/)

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
  authoring/           離線原生像素工具，不由runtime引用
  features/
    profile/           個人內容、網站版面、靜態HTML與像素UI
    referenceScene/    原生像素圓形展示、原GIF時鐘、圖集與生命週期
    portrait/          歷史近景播放器，明確入口才載入
  shared/              共用動畫型別
  archive/             legacy／voxel歷史模式及舊field renderer對照
scripts/
  assets/              素材匯出與來源驗證
  qa/                  真實網站截幀、瀏覽器與效能檢查
  tests/               Node單元測試
  deploy/              手動部署備援
reference-projects/    使用者完整工程ZIP、原檔與來源校驗
public/assets/reference-scene/  共享調色盤的源／平滑圖集與後備首幀
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

預設場景使用原GIF1280ms時鐘，rAF不鎖60Hz，隱藏／離屏停止繪製並保留相位；減少動態免下載圖集，可明確啟用並恢復。載入逾時、取消、重試和無JS首幀保留完整網站可用性。離線運動估計／像素作者工具、runtime播放器及圓形展示分開，來源驗證和實際CSS截圖驗證共同防止重新降採樣。

[目前指南](docs/guides/reference-gif-rebuild.md)與`artifacts/crisp-circle/`記錄本版清晰度、源錨點、125Hz估計樣本、144Hz模擬回調、生命週期、整站及production效能。預覽編碼率和模擬callback不等於實體顯示器FPS，細髮與遮擋的估計仍有限制。舊12秒物理風／24秒眨眼僅屬歷史肖像，見`docs/guides/video-layered-rebuild.md`。

## 素材

`assets/source/**`及`docs/reference/**`保持唯讀。新首頁權威是`reference-projects/fuji-wind/`完整原工程；歷史近景canonical母版仍在 `assets/generated/portrait-v4/`，局部髮後修復在 `assets/generated/portrait-wind/`，runtime為 `public/assets/portrait-natural/`。不輪播新生成的臉、不整張圖晃動，也不擴圖成完整胸像。[素材清冊](docs/guides/asset-inventory.md)記錄來源及限制。

貝爾摩德出自《名偵探柯南》，角色權利屬原權利方，本專案為個人非商業粉絲作品。Minecraft為相關權利方商標，本站不是官方合作產品。見[變更紀錄](CHANGELOG.md)。
