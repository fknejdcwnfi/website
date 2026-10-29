> **歷史快照：2026-10-29，PR #6版本。** 本文的2300 ms風動、每輪眨眼及數值只適用當時版本；目前持續微風、獨立眨眼與圓形展示以[現行指南](../guides/reference-wind.md)為準。原始證據仍保留，不以歷史通過項數替代新驗證。

# 參考風動、密集截幀與高更新率

- 日期：2026-10-29
- 目前權威：使用者要求原近景、Minecraft像素風、透明無框、參考圖的豐富風動與眨眼配合，並明確恢復自動合併與網站更新。
- 個人內容、真實作品、Email與後續功能仍依[個人網站](../guides/personal-site.md)；角色身份與原始來源保護沿用[Living Portrait](../guides/living-portrait.md)。

## 為何前版只容易看見眨眼

v4的九組局部場在預設256²網格中，多數最大位移僅0.7–1.8個邏輯像素，並在舊輪廓邊緣衰減到0；即使像素差分非零，正常頁面仍不容易看出風勢。新的驗收必須檢查輪廓／前景卷髮的可見位移，並將完全睜眼時的風動與眼瞼差分分開。前版數字不是新版可見度證明。

## 動作與渲染

仍按 `docs/reference/10_frame_prompts.md` 及十張不可修改的原始幀理解動作，不輪播那些臉部不一致的生成圖。

| 階段 | 畫面行為 |
| --- | --- |
| 0 ms | 原v4近景完全相同的靜止像素 |
| 230 ms | 右外層先捕捉微風，開始輕抬 |
| 460 ms | 外層／後髮分別流動；前景卷髮稍後跟上 |
| 630–850 ms | 上眼瞼閉合／重開，風仍穿過發束；740 ms全閉 |
| 1020 ms附近 | 長卷髮上揚、拖尾；發梢位移大於髮根，左右耳環不同步跟隨 |
| 1300–1570 ms | 風向回轉，短／長髮不同慣性回彈，長卷髮與耳環阻尼回落 |
| 1890–2300 ms | 回到與原始靜止像素完全相同，接續下一輪 |

八個髮組各有十七個鏈段取樣點，風的彈簧響應、短段陣風、髮梢延遲、水平擺動與垂直上揚分開計算。前景卷髮的自由輪廓可移到原本的透明區／肩旁遮擋走廊；髮根、臉、項鏈與其餘身體保持固定。左右耳環是第9／10條獨立延遲通道。時間按毫秒取樣，60／120 Hz不改速度。

角色始終來自未改動的 `assets/generated/portrait-v4/open.png`。新增[隱藏底圖來源](../../assets/generated/portrait-wind/README.md)僅補髮束移開後的區域。先移除原位置的前景髮束，再反向取樣每個變形髮層，避免固定舊髮與動髮重疊。底圖的臉不會替換到角色上。身體底圖不做呼吸、平移或縮放，只會被頭髮遮住／露出；沒有以整圖晃動假裝風吹。

變形權重可平滑，角色顏色不平滑：輸出始終是192²／256²／320²邏輯格、固定42色、alpha0或255、nearest-neighbor顯示。眼瞼僅在兩個精確眼區取閉眼donor。正常首頁持續循環，減少動態、隱藏／離屏停止與原相位恢復、debug的明確pause／t／pose仍保留。畫布與人物皆無可見方形框。

[manifest](../../public/assets/portrait-natural/manifest.json)版本5包含九張PNG：角色、眼瞼、髮後底圖，各三種網格。預設三張runtime PNG合計145,066 bytes；原始source／reference及v4 canonical PNG的雜湊不變。新增底圖是AI輔助局部修復，不能宣稱完整來源一致分層或所有角度都已補齊。

## 本輪細化與取樣方法

髮束由九段細化為十七個取樣站，以C1連續的cubic Hermite曲線連接；髮梢加入延遲彈簧速度驅動的微捲及回彈，從根部到尾端以u³增加，經tanh限制幅度，長髮尾端較明顯。八組髮束、兩條獨立耳環通道、220 ms局部眨眼與2300 ms錨點不變；不加隨機抖動，不改canonical臉／身體／素材。

renderer預先建立目的列跨度、每列第一步反向取樣快取及局部眼瞼／耳環像素清單，降低每幀重複座標計算；不降低動作取樣率、不新增低FPS節流。十七段及髮梢細化是刻意的視覺改善，以下新驗證要求固定人物區與根點不變、動髮及輪廓清楚可見，而不是要求最終所有像素與舊版相同。

新的截幀工具從實際網站Canvas取得2300 ms循環內276個均勻時刻，等距約8.333 ms，另外保留十個明確姿態及十個精確連續錨點。PNG按SHA去重存放，manifest仍列出每個時刻、來源、檔案及雜湊；`gallery.html`提供完整時間軸，144張縮圖的contact sheet便於查看髮絲與眨眼變化。這些是實際renderer的確定性時間取樣，網站runtime仍是連續程序化渲染，不會載入幾百張圖播放。

角色GIF目標為115個20 ms時槽，每槽選最近的真實120 Hz樣本，取樣時間誤差最多約3.334 ms；相同畫格可由編碼器合併。首頁GIF另擷取58個實際畫面，40 ms時槽、末槽20 ms，合計2300 ms。需要同時看原PNG與連續動畫，不能用GIF的編碼率宣稱螢幕FPS。

高更新率量測分為原生requestAnimationFrame、解除排程上限後的CPU吞吐量，及模擬60／120／144／240 Hz的時間／像素等價性。模擬只證明速度與像素不依更新率改變；原生headless瀏覽器約60 Hz的環境不能驗證實體240 Hz螢幕。量測結果保留production建置、網格、視窗、穩定／取樣時間、callback成本與長任務。

## 本輪實際證據

新截幀、完整UI與原生／模擬更新率結果集中在 `artifacts/pixel-world/`。已執行結果：

- 37項Node單元、型別與production build通過，包含可選社群／遊戲設定的驗證與靜態HTML一致性。原始來源、canonical母版、凍結參考及workflow未修改。
- [角色QA](../../artifacts/pixel-world/qa.json)51項通過，無瀏覽器錯誤；十七個鏈段與三種網格、可見風動、眨眼、透明度、生命週期及歷史模式均通過。
- 1020 ms睜眼風動改變8,253像素，輪廓alpha改變908像素；前景卷髮C1逐列變形峰值約22.167／23.217邏輯像素。27,519個保護區像素與160個根部錨點零改變，1,085個眨眼差分全部限於眼區。
- 2,592個移開位置實際露出修復底圖，所測不透明底圖區域零破洞；固定42色、來源及動畫均為二值alpha，100輪各13個相位逐像素一致。
- 真實PortraitPlayer與Canvas在模擬60／120／144／240 Hz、跨到第二輪的14個時點（230–3320 ms）均為零時間偏差、相同畫布像素，排程佇列最多1個。這是模擬rAF相位驗證，不是原生螢幕更新率。
- [完整網站QA](https://github.com/fknejdcwnfi/website/blob/ba3a789111a66090591e88e187aaa5ba2feb2b31/artifacts/personal-site/checks.json)41項通過，正常頁面無錯誤；保留四種寬度、完整內容、鍵盤、無JS及六種預期故障備援。正常首頁不載入歷史模式程式或舊runtime素材；明確歷史模式chunk被攔截時仍保留個人網站。

### Production效能

[本輪效能JSON](../../artifacts/pixel-world/performance.json)使用fresh單頁headless Chromium 154、1200×1000／DPR1、無CPU節流，每輪穩定2500 ms後取樣約5秒，期間不截圖。原生與解除frame pacing各開新頁；兩者均無長任務、瀏覽器或HTTP錯誤。

| 模式／區段 | 實際排程或吞吐量 | callback CPU中位數／p95 |
| --- | --- | --- |
| 原生rAF，全循環 | 300次繪製／5秒，60.0次／秒 | 3.7／5.5 ms |
| 原生，230–1890 ms動態段 | 約60.0次／秒 | 3.9／5.9 ms |
| 原生，630–1570 ms強風段 | 約60.0次／秒 | 4.0／6.5 ms |
| 解除排程上限，動態段 | 約269.23 callbacks／秒的分相位估計 | 3.2／5.3 ms |
| 解除排程上限，強風段 | 約271.14 callbacks／秒的分相位估計 | 3.2／4.7 ms |

採用動態段及強風段吞吐量，避免1890–2300 ms靜止段快速重畫把整體平均抬高。分相位估計按rAF時間戳及其結束相位歸類，不是實際螢幕FPS；callback成本也不包含GPU、合成器、瀏覽器與OS的完整負載。此容器確認原生60 Hz與模擬高更新率的正確性，尚未驗證實體240 Hz顯示器上的穩定240 FPS。

### 實際密集影像

[截幀紀錄](../../artifacts/pixel-world/capture.json)與[SHA清冊](../../artifacts/pixel-world/frames/manifest.json)已完成：276個120 Hz時間軸樣本、十個明確姿態及十個精確連續錨點，去重後205張PNG、10,787,883 bytes；所有時刻都映射到實際檔案，姿態1／10一致，擷取無瀏覽器錯誤。

可直接檢查[144張縮圖](../../artifacts/pixel-world/contact_sheet_144.png)、[原圖／靜止／風動／閉眼](../../artifacts/pixel-world/comparison.png)，或本機開啟[完整276時刻HTML圖集](../../artifacts/pixel-world/gallery.html)。[角色GIF](../../artifacts/pixel-world/animation_preview.gif)取115個來源樣本，編碼84幀、2300 ms、1,631,187 bytes，最近120 Hz樣本的最大時間誤差3.333333 ms；[首頁GIF](../../artifacts/pixel-world/website_motion.gif)取58張實際截圖，編碼43幀、2300 ms、7,598,461 bytes。GIF供視覺檢查，原生FPS仍以效能JSON判讀；這批證據不進入dist或runtime載入。

下節已發佈前版數字只作基線，不移作這次密集取樣與細化的結果。

## 前版已發佈基線：分層風動

- 32項Node單元、型別、production build、legacy資產與九張新runtime資產／來源驗證通過。
- [肖像QA](../../archive/evidence/portrait-v5/qa.json)48項及[完整網站QA](https://github.com/fknejdcwnfi/website/blob/be7b77652d1deef783999d4fd1f459d41506249e/artifacts/personal-site/checks.json)37項通過；正常頁面無瀏覽器／HTTP錯誤。網站保留320／390／768／1440響應式、真實連結、鍵盤、無JS與四種故障備援。
- 1020 ms睜眼風動相較靜止改變8,243像素，輪廓alpha改變903像素；前景卷髮控制點峰值約22.2／23.3邏輯像素。位移是變形控制量；效果同時以實際畫面、輪廓及像素差分檢查。
- 八髮組與左右耳環皆有局部變化。27,519個保護區像素、160個根部錨點零改變；1,085個眨眼變化全部限於眼區。肩旁允許頭髮遮擋，不再把所有皮膚像素都誤稱不可遮擋的固定錨點。
- 睜眼時230／460／630／740／850／1020／1300／1570 ms的風動差分依次為 288／4568／6601／7398／7885／8243／6550／4598；風動不是由閉眼素材產生。
- 2,601個移開位置實際顯示補繪底圖；所測不透明底圖區域零破洞。固定42色、透明像素零半透明；100輪各13相位完全一致，0／1890／2300 ms和風力0回到原始基底。
- [production效能](../../archive/evidence/portrait-v5/performance.json)：fresh單頁headless Chromium、1200×1000／DPR1、無節流，1.5秒穩定後取樣5秒，300次繪製／60.0 fps、callback中位數4.55 ms／p95 6.5 ms，無長任務。這是容器穩態樣本，不能代表所有裝置、GPU或啟動成本。

[角色動畫](../../archive/evidence/portrait-v5/animation_preview.gif)與[首頁動畫](../../archive/evidence/portrait-v5/website_motion.gif)來自實際網頁的確定性時間取樣，對照見[comparison.png](../../archive/evidence/portrait-v5/comparison.png)。GIF為67個實際時刻、角色動畫編碼51幀、2300 ms；`artifacts/`不進入dist，不是網站執行時下載。GIF的編碼率不當作即時FPS；其取樣、來源SHA與時長在[capture.json](../../archive/evidence/portrait-v5/capture.json)。

## 個人化與發佈

使用者的fknejdcwnfi／HELLOWORLD／Email、真實作品及`SiteShell`擴充插槽不與髮束rig耦合。UI保留暖白、森林綠和像素字體，品牌加入草方塊色帶，按鈕提供像素式按壓回饋與清楚焦點。角色展示尺寸及近景裁切沿用，不擴圖為完整胸像。

最新「自動合併和更新」明確解除先前暫不發佈限制；本輪在本地檢查與PR的CI通過後自動合併到main，核對GitHub Actions／Pages部署。保持工作流與分支保護，不使用強制推送手動備援。若執行環境僅允許api.github.com，核對Actions和Pages API，不能把政策對公開網站主機的封鎖當作訪客故障。
