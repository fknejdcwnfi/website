# fknejdcwnfi · 我的像素小世界

**HELLOWORLD**。fknejdcwnfi的個人網站，以高清Minecraft-inspired2D像素圓形呈現Vermouth。

- [正式網站](https://fknejdcwnfi.github.io/website/) · [目前重構指南](docs/guides/poetic-pixel.md)
- [完整不可變原工程](reference-projects/fuji-wind/) · GitHub：<https://github.com/fknejdcwnfi> · Email：**fknejdcwnfi@gmail.com**

最新精修保留原樱花、富士山、暮色與無邊框圓形。固定96色保留原72色，新增24種原畫顏色，細化髮絲與景物層次；輪廓採兩次既有顏色重建，畫布依實際尺寸／DPR選擇1432×1068、2148×1602或最高2864×2136。原16幀錨點與50fps來源過渡保持。

448片三層雪與60片粉色花瓣沿獨立長周期交錯飄落；32朝向、5側轉讓花瓣開合更細膩，保留臉部柔和減量。首屏40片雪／12片花瓣從HTML/CSS便開始動，不等待主程式或影片；同節點預覽按影片相位接手，只對氣象作180ms過渡。

![目前網站](artifacts/scenic-refinement/site/desktop.png)

[雪與粉色樱花實際圓形](artifacts/scenic-refinement/site/weather-time8000.png) · [實際動態預覽](artifacts/scenic-refinement/preview/animation.mp4) · [色彩細節對照](artifacts/scenic-refinement/style/background-closeups.png) · [完整檢查](artifacts/scenic-refinement/site/checks.json)

PNG8以明確色板索引保存，正常媒體約2.77MB；顏色增加使主圖集比前版增大約18%。執行時一次讀取原生圖集，換幀不再配置／讀回原生ImageData，仍只快取兩張高清幀。原ZIP及22份檔案不變；原片358×267／12.5fps，48個過渡幀為估計，放大不創造缺失原畫。當前說明：[場景指南](docs/guides/poetic-pixel.md)，驗證在`artifacts/scenic-refinement/`，舊artifact保留為歷史。

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
  authoring/           歷史來源轉製工具，不由runtime引用
  features/
    profile/           個人內容、網站版面、靜態HTML與像素UI
    referenceScene/    共用圓形UI／可見性播放器與來源時鐘
    poeticPixel/       唯一預設：場景組合、來源播放及同節點入口
      presentation/  一次原生讀回／兩幀像素重建／分辨率事件
      atmosphere/    雪、花瓣、精靈圖集與組合繪製
    faithfulPixel/     歷史16幀直接像素轉製
    calmPortrait/      歷史固定人物／小幅後髮rig，不由現在首頁載入
    portrait/          歷史近景播放器，明確入口才載入
  shared/              共用動畫型別
  archive/             legacy／voxel歷史模式及舊field renderer對照
scripts/
  assets/              素材匯出與來源驗證
  qa/                  真實網站截幀、瀏覽器與效能檢查
  tests/               Node單元測試
  deploy/              手動部署備援
reference-projects/    使用者完整工程ZIP、原檔與來源校驗
assets/generated/      歷史生成母版、局部眼瞼與姿態字段，非目前素材
public/assets/reference-scene/  歷史場景素材，不由現在首頁載入
public/assets/poetic-pixel/    現在的原生圖集、高清首幀、首屏影片及來源清冊
public/assets/faithful-pixel/  歷史16幀直接像素素材
public/assets/calm-circle/     歷史固定人物與後髮圖層
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

目前唯一預設在`src/features/poeticPixel/`，其中`presentation/`與`atmosphere/`分別管理清晰度／尺寸及雪／花瓣。`referenceScene/`仍負責共享生命週期與圓形UI；重新調整畫布不會重新解碼圖集或把來源動作歸零。AGENTS已移除互相混淆的舊rig「目前狀態」，歷史實作與證據維持原位。

場景命令亦已更新到當前實作：

```bash
npm run source:verify   # 不可變完整原工程
npm run scene:derive   # 來源50fps估計，16原錨點保持
npm run scene:export   # 目前像素素材、高清首幀及低延遲預覽
npm run scene:verify   # 目前來源／像素／高清完整性
npm run scene:qa       # production瀏覽器驗證
npm run scene:capture  # 實際圓形動畫截幀
npm run scene:measure  # 其它瀏覽器關閉後獨立量測
```

作者工具需要Pillow／NumPy／FFmpeg，瀏覽器工具需要Playwright／Chromium；CI資產驗證僅用Python標準庫。[目前指南](docs/guides/poetic-pixel.md)包含完整重跑、尺寸上限、動態偏好及來源限制。

## 素材

`assets/source/**`及`docs/reference/**`保持唯讀。新首頁權威是`reference-projects/fuji-wind/`完整原工程；歷史近景canonical母版仍在 `assets/generated/portrait-v4/`，局部髮後修復在 `assets/generated/portrait-wind/`，runtime為 `public/assets/portrait-natural/`。現在的臉與動作直接取自原動畫，不輪播獨立生成的臉，不使用整圖位移場，也不擴圖成完整胸像。[素材清冊](docs/guides/asset-inventory.md)記錄來源及限制。

貝爾摩德出自《名偵探柯南》，角色權利屬原權利方，本專案為個人非商業粉絲作品。Minecraft為相關權利方商標，本站不是官方合作產品。見[變更紀錄](CHANGELOG.md)。
