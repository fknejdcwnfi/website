# 歷史快照 · PR #7持續微風版本

- 封存日期：2026-10-29
- 對應版本：PR #7，commit `4e9725b527b0b0fbe454eb6fe828a80486a0d45a`
- 用途：保存12秒微風、24秒眨眼及當時量測；目前圓形內髮動以[現行指南](../guides/reference-wind.md)為準。
- 可變動的personal-site證據連結固定到此commit，其餘gentle-portrait影像與JSON原樣保留。

---

# 持續微風、獨立眨眼與清晰像素

- 日期：2026-10-29
- 目前權威：使用者要求頭髮持續緩慢飄動、偶爾眨眼、動作過渡自然；人物居中、圓形、無框，整站延續Minecraft像素UI。
- 決策：[ADR-020](../decisions.md#adr-020--持續緩慢微風獨立眨眼與居中圓形展示)

## 問題與新的節奏

前版把參考圖濃縮為2300 ms：風起、回轉、停在原像素，再於下一輪重來；眨眼也每輪固定發生。即使每一段曲線連續，短促的起落與約410 ms靜止仍容易顯得急促、斷續。使用者現在要求持續的輕風，而不是反覆播放一次陣風。

新風週期為 **12,000 ms**，以平滑、可重現的穩態響應疊加不同層次。各髮束保留不同延遲、剛度／阻尼、髮根到髮尾權重與耳環慣性；17站C1曲線連接空間變形。風不在輪末套歸零包絡，也不在每輪重新啟動彈簧。解析風場的週期邊界位移與各階導數吻合；runtime使用1 ms Float32表與線性插值，因此以接縫數值檢查驗證位置／速度，不宣稱離散像素具有連續導數。沒有刻意安排的全靜止區。

正常播放的0 ms可以是輕風中的一幀。完整canonical靜止由明確的pose1／10或減少動態提供，不把自然時間軸硬切回poster。`wind=0`只關閉髮動／耳環，眨眼仍按獨立時鐘發生；例如t=4500仍可閉眼。臉、髮根、項鏈與其餘固定人物區維持穩定，髮尾只作較克制的局部變形。原始分鏡仍提供髮束延遲／回彈與眨眼意圖，不再規定首頁必須以2.3秒完成一次動作。

## 兩個獨立時鐘

| 時鐘 | 目前設定 | 意義 |
| --- | --- | --- |
| 風 | 12,000 ms；十個觀察錨點0、1200…10800 ms | 連續慢風，各組響應不同；錨點是檢查位置，不是十張圖播放 |
| 眨眼 | 24,000 ms；事件起點4400、11300、20300 ms | 事件相隔6.9、9.0、8.1秒，不跟隨每次風循環重設 |
| 每次眨眼 | 100 ms閉合、20 ms保持、160 ms重開，共280 ms | 閉合較快、重開較舒緩；眨眼時髮絲與耳環不停 |

風經過12秒回到相同相位時，眼睛不必相同；整體24秒才同時重複。`samplePortrait`先以完整經過時間取獨立眼事件，再提供風的週期相位。rAF按毫秒delta推進，不依顯示幀數決定速度；60／120／144／240 Hz應得到相同時間及畫面。眼瞼在全開／全閉端點採明確的數值狀態，避免極小浮點誤差觸發不同像素分支；高Hz驗證仍要求相同時間點的畫布一致。`gust`現在調整風的層次，不再是Hz頻率；其他範圍由 `stageOptions.ts`驗證。

`?t=4510`可檢查首次閉眼保持；`?pose=5`是固定閉眼美術覆寫。`t`接受0–120,000 ms以檢查多輪風及眨眼，pose優先。正常首頁沒有公開播放／暫停控制；`?view=portrait&debug=1`保留檢查入口。減少動態／明確pause／離屏／隱藏分頁仍優先，返回時保留原相位。

## 像素與展示

延續同一v4 canonical近景及局部眼瞼／髮後修復，不換臉、不生成一串不同人物，也不以整張圖移動冒充風。內部仍是192²／256²／320²、固定42色與二值alpha；nearest-neighbor和局部取樣保留像素群組，沒有用模糊濾鏡掩蓋髮束變形。

人物位於頁面中軸，透過無框圓形視窗展示。圓形只作用在顯示容器，不改原始畫布或canonical素材；初始poster、Canvas、無JS和故障備援使用同一裁切。互動頁面根據可用寬度和DPR選擇整數實體像素倍率，尺寸改變才重新計算，不在逐幀播放時反覆layout。

整站保留草地／泥土色帶、方塊品牌、物品欄作品與像素圖示；圓形只用在使用者指定的人物展示。真實個人內容與B站／抖音、王者荣耀／火影忍者配置依[個人網站](../guides/personal-site.md)，不將角色時間軸耦合到文案或帳號。

## 驗證與證據

本輪41項單元、型別、production build及素材／來源驗證已通過。瀏覽器與影像證據目錄為 `artifacts/gentle-portrait/`。檢查覆蓋：

- 慢風完整週期及多輪接縫，沒有舊輪末靜止包絡或突然歸零；眨眼前後及眼睛保持睜開時都能觀察局部髮動。
- 24秒內三次獨立眼事件、280 ms局部眼瞼、固定臉／髮根、耳環差異、42色與二值alpha。
- 真實player的可見性、減少動態、顯式靜止、銷毀與60／120／144／240 Hz模擬相位一致性。
- 圓形無框、水平置中、DPR整數縮放、四種螢幕寬度、鍵盤、真實內容與無JS／故障備援。
- 實際Canvas密集圖集、眼事件局部高密度樣本、GIF及production效能。圖片與GIF不隨runtime下載，不把取樣密度當作螢幕FPS。

### 本輪肖像結果

[肖像QA](../../artifacts/gentle-portrait/qa.json) **55項通過**，無瀏覽器錯誤。12秒內24個500 ms視窗都出現風動，最少285個像素變化；八髮束及左右耳環均有可見像素改變。長捲髮峰值約6.837／7.457邏輯像素，幅度較前版約22–23像素克制；全週期最大輪廓差分282像素。

27,519個保護像素與160個髮根零改變，眼瞼差分只在眼區，所測修復不透明區零破洞。100個風週期各13相位逐像素一致；真實player在模擬60／120／144／240 Hz的13個共同時點亦逐像素一致，排程佇列最多一條。這些結果驗證持續風、固定區與更新率無關的時鐘，不代表所有實體裝置的FPS。

### 完整網站結果

[網站QA](https://github.com/fknejdcwnfi/website/blob/4e9725b527b0b0fbe454eb6fe828a80486a0d45a/artifacts/personal-site/checks.json) **65項通過**，正常頁面無錯誤，六種故障備援均通過。涵蓋320／390／768／1440寬度、DPR1／2、圓形無框與水平置中、實體像素倍率及原點對齊、鍵盤、真實內容、離屏／減少動態和無JavaScript。

桌機直徑512 CSS像素，在DPR1／2分別讓每個邏輯像素對應2／4個實體像素；本輪手機樣本直徑256 CSS像素，分別為1／2個實體像素。所測水平中軸誤差為0，實體像素原點為整數。尺寸仍按實際可用寬度及DPR計算；不將這兩個樣本尺寸寫死為所有裝置的唯一外觀。

新[桌機](https://github.com/fknejdcwnfi/website/blob/4e9725b527b0b0fbe454eb6fe828a80486a0d45a/artifacts/personal-site/desktop.png)、[手機](https://github.com/fknejdcwnfi/website/blob/4e9725b527b0b0fbe454eb6fe828a80486a0d45a/artifacts/personal-site/mobile.png)、[無JS](https://github.com/fknejdcwnfi/website/blob/4e9725b527b0b0fbe454eb6fe828a80486a0d45a/artifacts/personal-site/no-javascript.png)截圖由同一production版本取得，poster、正常Canvas與降級人物均使用無框圓形。舊personal-site效能JSON已作歷史封存，當前效能只以下方gentle-portrait的實測為準。

### Production效能

[本輪production量測](../../artifacts/gentle-portrait/performance.json)每個模式各開fresh單頁headless Chromium，1200×1000／DPR1、無CPU節流，先穩定2500 ms再取樣完整12秒風週期，期間沒有截圖或其他瀏覽器工作。兩個模式均無超過50 ms長任務、正常頁面JavaScript或HTTP錯誤。

| 模式 | 實際Canvas繪製與吞吐量 | callback CPU中位數／p95 |
| --- | --- | --- |
| 原生rAF | 721次／12.003秒，60.07次／秒 | 3.9／5.2 ms |
| 解除Chromium幀率限制 | 3263次／12.004秒，271.82次／秒 | 3.5／4.0 ms |

整個12秒都是活動微風，沒有舊靜止段灌高平均吞吐。原生值描述此容器的排程；解除幀率限制的值描述callback／繪製吞吐，不是實體271 Hz顯示器實測。GPU、合成器、瀏覽器與OS仍有額外成本，尚未驗證實體120／144／240 Hz裝置的穩定FPS。

量測必須保留瀏覽器、production建置、視窗、DPR、穩定與取樣時長。原生rAF顯示排程、解除排程限制後的運算吞吐量、模擬高更新率分開解讀；callback不包含GPU／合成器／OS的全部成本，不能直接保證實體240 Hz裝置。

### 密集圖集與完整24秒預覽

[截幀紀錄](../../artifacts/gentle-portrait/capture.json)與[SHA清冊](../../artifacts/gentle-portrait/frames/manifest.json)保存完整24秒：每100 ms取樣240點，三個眨眼窗口再每10 ms細化，共 **327個時間點**；另有10個明確姿態及10個連續風錨點。全部347筆紀錄按內容去重為 **216張PNG，11,223,350 bytes**，每個時刻仍有獨立映射。姿態1／10相同，canonical靜止SHA與原始reference雜湊未變，擷取無瀏覽器錯誤。

[完整327時刻圖集](../../artifacts/gentle-portrait/gallery.html)、[144格縮圖](../../artifacts/gentle-portrait/contact_sheet_144.png)與[原圖／微風／閉眼對照](../../artifacts/gentle-portrait/comparison.png)展示實際256²邏輯畫布，供像素和身份核對；圓形展示由[24秒動態預覽](../../artifacts/gentle-portrait/animation_preview.gif)呈現。GIF取自實際production圓形容器的600張瀏覽器截圖，每40 ms一張，編碼600幀、24,000 ms、19,743,368 bytes，完整覆蓋兩輪風與三次獨立眨眼。25 Hz編碼是視覺預覽，不是網站即時幀率。

原始Canvas PNG、完整預覽與量測皆位於artifacts，不隨dist或首頁runtime下載。網站繼續載入同一少量材質作程序化渲染，不需逐張下載這些證據圖片。

## 歷史基線

[PR #6歷史指南](../archive/14-reference-wind-pixel-world.md)保留前版2.3秒、17段風動、37項單元／51項肖像／41項網站檢查及當時效能。其[276時刻圖集](../../artifacts/pixel-world/gallery.html)、[效能JSON](../../artifacts/pixel-world/performance.json)及205張實際PNG仍原樣保存，只用來比較舊節奏，不當作本輪通過證明。

更早v2／v4／v5的runtime及證據見[歷史資料](../../archive/README.md)。原始 `assets/source/**`、凍結 `docs/reference/**`及canonical母版不因這次節奏、顯示形狀或尺寸對齊而改寫。隱藏底圖仍只處理髮束移開後的局部遮擋，不能宣稱完整來源一致的分層補繪。

## 發佈

擁有者已授權自動合併和更新。相關本地審查、測試與CI通過後合併main，再核對GitHub Actions／Pages；不跳過檢查、停用workflow或強制推送備援。僅允許api.github.com的環境可用Actions／Pages API核對發佈，不能將環境對公開主機的政策拒絕解讀為一般訪客故障。
