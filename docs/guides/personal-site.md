# fknejdcwnfi 的完整個人網站

- **日期**：2026-10-29
- **範圍**：簡潔、可個人化、可建置發佈的標準個人網站，Vermouth 是首頁主視覺
- **決策**：[ADR-016](../decisions.md#adr-016--完整個人網站與肖像子系統分離)、[ADR-017](../decisions.md#adr-017--保留原近景去背與持續循環動態)
- **目前交付狀態**：使用者2026-10-29已明確恢復自動合併與網站更新；檢查通過後依PR／GitHub Actions流程發佈

## 1. 新範圍與內容

使用者已明確澄清「不是只有一個圖」，而是自己的完整個人網站。這取代先前「正式頁面只含角色、禁止導航／介紹／作品／聯絡」的產品限制。[Living Portrait](living-portrait.md) 繼續規範角色美術、動畫與素材保護，不再限制整站只能放肖像。

目前個人資料由使用者明確提供：稱呼 **fknejdcwnfi**、首頁招呼 **HELLOWORLD**、Email **fknejdcwnfi@gmail.com**。GitHub 入口為 `https://github.com/fknejdcwnfi`。不沿用公開姓名作網站稱呼，也不虛構職業、地點、客戶經歷、成就數字或其他社群帳號。

首頁包含：

- 可鍵盤操作的跳至內容連結、品牌與關於／作品／聯絡導覽。
- 個人招呼、簡短介紹、作品／GitHub 行動連結與 Vermouth 動態主視覺。
- 關於我、真實公開專案、Email／GitHub 聯絡區與頁尾。
- 作品 `website` 為持續製作中的個人網站；`xiangqi-review` 為已封存的 Java 象棋專案，狀態如實標示。

正常首頁不加入調試滑桿、假聯絡表單、登入、資料庫、假部落格或尚未實作的功能卡片。正常首頁不再提供播放／暫停按鈕，人物在可見時持續循環；完整風場控制與手動暫停仍只在 `?debug=1` 或明確QA參數中使用。

## 2. 視覺與角色

整站依本輪截圖改為靛藍雙層頁首、白底、左導航、中央正文與右目錄。個人內容保留真實介紹、作品表格、聯絡及頁尾；搜尋只索引已存在的本站內容，手機提供可展開的目錄。頁面使用可讀中文與清楚的鍵盤焦點，角色保持Minecraft-inspired像素藝術與自託管像素英文標記。完整重構與本輪驗證見[參考版面與物理重構](reference-rebuild.md)。角色本身不使用方形相框、底板、描邊卡片或方塊盒子；人物位於頁面中軸，以無框圓形容器裁切；同一透明近景融入暖白底。Press Start 2P位於 `public/fonts/`，授權為隨檔保存的[SIL OFL](../../public/fonts/OFL.txt)，不向外部字體服務請求。

肖像保留同一近景內部構圖與原始參考的2D臉型、眼神、捲髮及飾物；使用者已明確拒絕向外補畫完整胸像。不重新變成 Steve／3D voxel，也不為新網站版面改動 `assets/source/**` 或 `docs/reference/**`。預設256²邏輯畫布，替代192²與320²；方形只是內部座標，人物外部透明，頁面沒有方形相框。去背編輯母版在 `assets/generated/portrait-v4/`，runtime在 `public/assets/portrait-natural/`。alpha保留為透明／不透明像素，不把透明區填成方形背景。目前12秒持續微風與24秒獨立眨眼時鐘取代舊2300 ms陣風；局部眼瞼／耳環與減少動態處理保留。圓形只裁切顯示，不改原始畫布；可互動頁面按DPR選擇整數實體像素倍率。`?view=portrait` 為獨立肖像檢視；舊 voxel／legacy 仍是歷史比較，不是首頁預設。

## 3. 可個人化的結構

| 檔案 | 責任與修改入口 |
| --- | --- |
| `src/features/profile/content/site.ts` | 名稱、HELLOWORLD、介紹、Email、GitHub、導覽與作品陣列；新增真實作品不需改動畫 |
| `src/features/profile/content/site.example.ts` | B站、抖音、王者荣耀與火影忍者的型別工廠；只作設定參考，不由runtime載入 |
| `src/features/profile/components/SiteShell.tsx` | 共享頁首、主內容插槽、頁尾與跳至內容；後續頁面／區塊可沿用 |
| `src/app/App.tsx` | 組合首頁 hero、肖像與個人內容，並分流獨立肖像檢視 |
| `src/features/profile/components/PortraitViewport.tsx`、`presentation/pixelViewport.ts` | 圓形展示、可用寬度／DPR的整數實體像素倍率及原點對齊；不修改角色時間軸 |
| `src/features/profile/components/PersonalSections.tsx` | 關於、作品與聯絡；只渲染設定中存在的資料 |
| `src/features/profile/styles/site.css`、`src/features/profile/styles/sections.css` | 網站配色、像素字體、響應式與內容版面，與角色像素幾何分離 |
| `src/features/profile/content/staticMarkup.ts`、`vite.config.ts` | 從同一份個人設定產生初始HTML與metadata，JavaScript不可用時仍有完整內容 |
| `SiteBoundary`、`PortraitBoundary` | 整站／肖像失敗時保留可瀏覽的靜態內容 |
| `src/features/portrait/renderer/`、`animation/` | 角色資產、保護區、局部渲染與時間軸，不綁個人文案 |

未來可加入真正的文章、作品詳情或其他頁面，先在 `SiteShell` 的內容區組合新元件，再更新導覽與靜態備援。不先安裝路由／CMS／後端來填空，也不把尚不存在的內容當作已完成。若改網址或自訂網域，另核對 Vite base、canonical、OG、sitemap 與 Pages 設定。

### 帳號與遊戲擴充

`SiteContent.socials`與`gameProfiles`預設都是空陣列。沒有使用者提供的資料時，網站不展示空帳號、遊戲卡片、遊戲導覽或無效控制。

| 設定 | 欄位與顯示條件 |
| --- | --- |
| `SocialProfile` | `id`、`platform`（`bilibili`／`douyin`／`other`）、`label`、`href`及可選`handle`；名稱／id非空且href為HTTPS才加入聯絡入口 |
| `GameProfile` | `id`、`game`（`honor-of-kings`／`naruto`／`other`）、`label`；至少填公開`playerName`或`playerId`，可選`region`、`description`、HTTPS `href` |
| `getSocialLinks` | 合併實際GitHub／Email及通過驗證的額外社群，React與靜態HTML共用 |
| `getGameProfiles` | 過濾未設定帳號；無有效網址仍可顯示真實文字資料，無效網址不做成連結 |
| `getSiteNavigation` | 只在至少一筆有效遊戲資料時，在聯絡前插入能到達的`#games`導覽 |

[範例檔](../../src/features/profile/content/site.example.ts)提供 `bilibiliProfile(spaceUrl, publicName)`、`douyinProfile(profileUrl, publicName)`、`honorOfKingsProfile(publicPlayerName, region?)`與`narutoProfile(publicPlayerName, region?)`。參考其輸出格式，把你確認願意公開的資料填入 `site.ts`；沒有虛構帳號ID或預設玩家資料。B站／抖音需要自己的公開HTTPS主頁；遊戲資料可以只顯示暱稱與區服。

## 4. 可用性與降級

初始HTML含真實介紹、作品、聯絡連結與同一肖像，不再是空的 `#root`。JavaScript被停用、主module載入失敗或互動程式出錯時，靜態網站仍應可閱讀與導覽。

角色素材載入有12秒逾時；失敗後停止動畫排程／監聽，改用獨立根目錄 `portrait-rest.png` 768²透明靜態肖像，避免同一資產路徑失敗後持續空白。首次實際畫布繪製前保留poster，避免人物離屏時完成載入卻尚未繪製而空白；繪製成功後不疊加重複人物。React錯誤邊界保護其餘個人內容；正常載入不顯示故障訊息。減少動態偏好仍應尊重，靜止模式不持續排程動畫。

正常首頁的頭髮在可見時持續輕柔飄動，沒有舊輪末靜止段；眨眼以獨立事件時鐘偶爾發生。完整頁面可捲動，離屏或隱藏分頁時暫停繪製，回到畫面後從原相位續播；減少動態偏好與明確debug／QA暫停仍優先。

這些處理提高程式與資產失敗時的可用性，不能保證修復使用者所在地的DNS、連線或GitHub Pages限制。使用者已回覆先前網址現在可開啟；本輪沒有證據可把先前連線問題定性為程式404。環境代理若只允許 `api.github.com`，其403也不能當作正式網站對一般訪客的HTTP回應。

## 5. 開發、驗證與發佈邊界

使用Node24與既有checkout：

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run assets:check
npm run assets:verify
npm run preview
```

dev路徑為 `/`，production預覽為 `/website/`。完整網站需檢查：桌面／手機／窄螢幕無水平溢位、頁面可捲動、導覽確實到達各區、作品連結與封存狀態正確、Email為真實 `mailto:`、鍵盤焦點正確、正常首頁沒有公開播放按鈕且動態持續循環。備援需檢查停用JS、攔截module、素材失敗／懸掛、Canvas初始化失敗時內容仍存在。肖像子系統的獨立測試使用 `?view=portrait`，不能再把首頁的合法導覽當作「不應存在的UI」。

使用者最新明確要求「自動合併和更新」，解除先前暫不發佈限制。完成修改、審查、建置與相關驗證後，自動建立PR、等待CI、合併並核對GitHub Pages部署；不能略過檢查或繞過分支保護。

## 6. 目前分層動態

本輪保留同一近景身份與個人化結構，將短促陣風改為緩慢持續微風、獨立偶發眨眼，並改為居中無框圓形與DPR像素對齊。最新驗證與實際動畫見[參考風動](reference-wind.md)；以下為v4小幅風場歷史。

## 7. 歷史基線

v4小幅風場曾通過31項單元、37項網站及42項肖像檢查；肖像歷史證據保留在 `archive/evidence/portrait-v4/`，不是新版可見風動的門檻。較早不透明肖像的網站為31／34／33項，其舊artifact保存在 `archive/evidence/portrait-v2/`。`artifacts/personal-site/`的完整網站檢查及截圖會隨目前網站更新，應以[參考風動](reference-wind.md)及最新JSON的狀態判讀。
