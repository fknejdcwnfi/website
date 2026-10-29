# fknejdcwnfi · 個人網站

**HELLOWORLD**。這是一個簡潔的 Minecraft 像素風個人網站：個人介紹、真實作品、Email／GitHub 聯絡方式，以及作為首頁主視覺的自然透明 Vermouth 動態像素近景肖像。

- 稱呼：**fknejdcwnfi**
- Email：**fknejdcwnfi@gmail.com**
- GitHub：<https://github.com/fknejdcwnfi>
- 網站正式網址：<https://fknejdcwnfi.github.io/website/>
- 目前網站契約：[12 個人網站](docs/12-personal-site.md)；肖像子系統：[11 Living Portrait](docs/11-living-portrait.md)

擁有者已於2026-10-29明確恢復自動合併與網站更新。完整個人網站與分層風動通過檢查後，以PR合併至main，經GitHub Actions發佈；不使用強制推送的手動部署備援。

目前保留原有近景大小、固定像素格與透明無框展示。八組髮束各有九段延遲彎曲，前景卷髮可離開靜止輪廓，配合眨眼、風向回彈與左右耳環。詳見 [豐富動態契約](docs/13-reference-wind.md)及[實際網站動畫](artifacts/rich-motion/animation_preview.gif)。

![個人網站首頁](artifacts/personal-site/hero.png)

[完整桌機畫面](artifacts/personal-site/desktop.png) · [手機畫面](artifacts/personal-site/mobile.png) · [無JavaScript畫面](artifacts/personal-site/no-javascript.png) · [風動對照](artifacts/rich-motion/comparison.png)

## 開發與檢查

使用 `.nvmrc` 指定的 Node24與既有雲端checkout：

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
```

`npm run build`會先跑單元測試，再型別檢查與打包。production預覽用 `npm run preview`，base為`/website/`；dev base為`/`。Python瀏覽器／素材工具是可選QA依賴，核心建置不需它們。

## 修改我的網站

主要內容集中在 [src/content/site.ts](src/content/site.ts)：名稱、HELLOWORLD、介紹、Email、GitHub、導覽與作品陣列。現有作品只列真實公開repo；`xiangqi-review`如實標為已封存，不填虛構履歷或假作品。

- 版面、頁首／頁尾：`src/components/SiteShell.tsx`
- 關於、作品、聯絡：`src/components/PersonalSections.tsx`
- Minecraft像素風配色與排版：`src/styles/site.css`及`src/styles/sections.css`
- 新功能：在`SiteShell`主內容插槽組合新區塊，再更新導覽與靜態備援；不需改角色rig
- 初始HTML／metadata：從同一份內容設定產生，避免停用JS或module失敗時只剩空白

Press Start 2P字體自託管，授權見 [public/fonts/OFL.txt](public/fonts/OFL.txt)；沒有外部字體服務請求。聯絡入口使用真實Email／GitHub，不以沒有後端的表單假裝送信成功。

## 動態肖像與備援

首頁保留原有近景尺寸與構圖的2D像素Vermouth、局部髮動、眨眼與耳環；不採Steve方頭方身，也不向外補畫全身。人物以透明自然輪廓融入柔和光暈，不加方形相框、底板或卡片。正常頁面持續重播2300ms動態，沒有公開播放／暫停按鈕；完整風場控制與明確暫停仍只在debug／QA參數中使用。

```text
?view=portrait
?view=portrait&debug=1
?view=portrait&t=740
?view=portrait&pixel=320
?view=portrait&style=voxel
?view=portrait&style=legacy
```

預設邏輯網格為256²，替代192²／320²；方形畫布僅是內部座標，人物外透明，不顯示方形底板。2300ms循環在畫面內持續重播；系統減少動態、隱藏分頁與離屏會暫停，恢復後續播原相位。`pause`／`t`／`pose`保留為明確QA覆寫。人物外部alpha保持透明且像素邊緣清楚；原有 `artifacts/comparison.png`與GIF只作v2不透明立繪歷史證據。

初始HTML會保留介紹、作品、聯絡及透明靜態肖像；素材有載入逾時，React／Canvas或動畫載入失敗時改為靜態呈現。首次實際繪製前保留poster，離屏載入也不留下空白人物區。這可避免程式故障造成空白，不能保證排除外部DNS或所在地網路問題。

## 驗證

目前分層風動的單元／瀏覽器、循環取樣、像素不變量及效能證據集中於 [13 參考風動](docs/13-reference-wind.md)、[肖像QA](artifacts/rich-motion/qa.json)、[首頁QA](artifacts/personal-site/checks.json)與[production效能](artifacts/rich-motion/performance.json)。新版門檻單獨驗證風動在眨眼前、眨眼中與睜眼後可見、前景卷髮位移、輪廓變化、遮擋補繪、固定42色及二值alpha，不能只用「有幾個像素改變」代表效果完成。

`artifacts/natural-portrait/`保留上一版小幅風場資料；`artifacts/`根目錄的立繪／voxel量測為更早歷史，不作新版成效證據。

## 素材與限制

`assets/source/**`及`docs/reference/**`保持唯讀。`original_reference.jpg`仍是角色身份／構圖的最高權威；網站內容不與人物像素幾何耦合。角色母版仍為 `assets/generated/portrait-v4/`；新增僅供髮束移開後使用的 `assets/generated/portrait-wind/underpaint.png`。runtime為 `public/assets/portrait-natural/`，靜態備援為768²的 `public/portrait-rest.png`。OG分享圖另行合成；來源限制另見 [素材清冊](docs/02-asset-inventory.md)。新增底圖僅修復局部髮束遮擋，完整分層仍受限，不宣稱角色還原度、所有裝置效能或主觀品質已「完美」。

貝爾摩德出自《名偵探柯南》，角色權利屬原權利方；本專案為個人非商業粉絲作品。Minecraft為相關權利方商標，本站不是官方合作產品。見 [文件導覽](docs/README.md) 與 [變更紀錄](CHANGELOG.md)。
