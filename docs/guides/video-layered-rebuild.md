# 影片驅動的獨立髮束重建

- 開始：2026-10-30；續作驗證：2026-11-04
- 最新要求：擁有者明確拒絕PR #9的髮動效果，要求從頭重做；保留已認可的眨眼及其餘網站／角色要求。
- 動作參考：本輪上傳的 `generated_video.mp4`，SHA-256 `2c1765e77e79e143c0b6e3c9e5ea6ee9d3925cf59bd8701868139f125489f827`。

## 差距與選擇

影片是544²、24fps、145幀、6.0417秒。去除眼距約8.67%的縮放和整體移動後，長髮仍明顯向兩側展開、抬起、改變曲率與間隙，再延遲回落。1.5–2.7秒及3.7–4.4秒有兩次主要風勢；原影片首尾不相同，也有臉型／鏡頭生成漂移，不能直接輪播或複製那些漂移。[實際分析及關鍵幀](../../artifacts/video-layered/reference/README.md)保留可檢查的依據，不把RGB差分冒稱精確光流。

前版即使通過像素／性能檢查，也沒有達到這種效果：髮束按世界y座標取樣，材料不是完整透明髮帶，底圖仍留後髮副本。單純增加舊位移場振幅或加入更多諧波不能補足這些結構問題。因此本輪替換材料、物理與渲染，不再以舊 `groups/weights` 反向形變作預設。

## 執行計畫與架構

1. 逐幀分析上傳影片，分離鏡頭／臉型漂移與髮束運動；以原canonical臉部為唯一身份來源。
2. 建立獨立髮束選擇matte（runtime按192／256／320格輸出，256格約11KB），把canonical拆成八條完整透明cutout、固定頭／臉／身體底圖、兩組隨髮移動的原圖投影及完整獨立首飾；補足既有髮後材料並移除靜止髮副本。
3. 每束沿自身S形中心線按弧長配置16個節點，前兩點固定；以固定240Hz、長度及有符號曲率XPBD約束、風阻／慣性／阻尼求運動，保留影片尺度的風勢與回落。
4. 在Worker預熱三週期，建立120Hz節點緩存。主執行緒按毫秒插值，骨骼旋轉驅動獨立三角網格，最近鄰取樣透明材料；沒有整張肖像平移／縮放或重新生成臉。
5. 以實際圓形畫面驗證髮帶弧度、輪廓分離、空隙、遮擋與髮梢延遲，再檢查保留眨眼、固定五官、色盤／alpha、生命週期及全站備援。
6. 量測production初始化與運行成本，保存新舊對照、實際動畫及限制。通過本地、獨立審查與CI後依既有授權合併並核對Pages。

嚴格TypeScript與typed arrays負責小型約束求解和像素渲染。昂貴預計算放入Worker，避免主執行緒卡住；沒有為語言名稱新增Wasm交換或另一套runtime。先實測新的網格光柵成本，再決定是否需要GPU，不能用換語言掩蓋缺少圖層與骨架。這是受約束的二維髮帶模型，並非完整三維逐根毛髮或流體求解。

## 保留與替代

原臉型、眼神、微笑、構圖、圓形無框中軸、最近鄰與二值alpha保留；既有24秒獨立眨眼與局部眼瞼不改。12秒外層風週期含兩段影片尺度的六秒動作短語，長髮運動取代前版微幅變形。藍色雙層導航、白底正文、搜索、真實內容、帳號設定及靜態降級保持。

舊renderer保留在 `src/archive/fieldPortrait/` 作明確對照；前版證據保留，不能因測試曾通過就宣稱美術要求已滿足。新證據集中 `artifacts/video-layered/`。新髮matte只作分層選擇，不將其生成顏色或五官用在人物上；來源與已知材料限制見[素材登記](../../assets/generated/portrait-rig/README.md)。

## 實質驗收

- 完整髮束材料，動髮移開後不留下靜止副本；實際圓形內能看見整束中段彎曲、髮尾延遲、輪廓與空隙變化。
- 固定節點、長度誤差、曲率、有限座標及週期接縫有量測；不同刷新率同時間得到相同姿態。
- 顏色來自canonical與既有底圖，固定五官及眼瞼身份不變，真實前景遮擋與改臉分開判斷；沒有透明臉洞或重複首飾。
- 480格GIF、參考影片24fps與程序化即時FPS分開；容器吞吐不當實機高刷保證。先看真實動畫，再判斷是否達到要求。

本文件中的計畫與門檻不是通過宣告；結果以本輪實際驗證及下方紀錄為準。

## 重跑命令

```bash
npm run dev
# 另個終端匯出selection資料（不是重新生成角色）
python3 scripts/assets/export_hair_matte.py
python3 scripts/qa/verify_layered_portrait.py --output artifacts/video-layered/qa.json
npm run build
npm run assets:check
npm run assets:verify
npm run preview
python3 scripts/qa/verify_personal_site.py --url http://127.0.0.1:4173/website/ --output artifacts/video-layered/site
python3 scripts/qa/measure_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/video-layered/performance.json
python3 scripts/qa/capture_portrait.py --url http://127.0.0.1:4173/website/ --output artifacts/video-layered/portrait
```

canonical靜止模式不啟動物理Worker；解除減少動態或把wind由0調至1才準備緩存。Worker準備期間保留poster，失敗回到完整網站的獨立靜態肖像；設定切換、隱藏、離屏及destroy不允許過期結果／錯誤破壞新狀態。


原圖肩前卷髮的投影另作兩組skin色材質，跟隨對應骨鏈並只在body receiver內合成；臉、項鏈、透明背景不可接收這些投影。靜態gain0仍直接畫canonical，動態不再留下原位舊投影。髮束的隱藏補邊只取原圖真實髮像素，而且必須由更高z髮層在休息位遮住。

可見性只按真實圓形判斷。早期QA額外加y<229，會錯排圓形下部實際可見區，已修正並保留首輪結果。髮梢在參考影片中會離開裁切，因此驗收要求圓內中段實際移動／改弧及輪廓開閉，加上完整髮梢的自由位移；不強迫髮梢在最大外飄時仍留在圓內，也不為這個錯誤門檻過量拉動額髮。

## 預烘焙初始化

開發／驗收仍可從原canonical逐層建材，正式Player改讀 `rig-{size}.json/png`。圖集無損打包canonical、closed、clean、repair、八髮束、兩投影及owner/face/body資料，PNG採顯式58色RGBA索引與alpha表，不量化／抖動。預設256圖集80,208 bytes，binding JSON約12KB；JSON重新驗證並以atlas SHA作圖片版本query，避免新binding配舊瀏覽器快取。

三尺寸共3,482,560個typed-array值與全部metadata和原算法完全一致，256的21組時刻／風量實際Canvas0像素差。靜態／動畫共用同一材料，Rig只複製可修改clean，保留共享輸入不變。非法schema、錯誤atlas尺寸、503與掛起request均回退完整網站／獨立768²poster。`baked-manifest.json`檢查來源程式、輸入圖與全部輸出雜湊，來源變動後必須重跑 `python3 scripts/assets/export_baked_portrait.py`。

## 最終驗證結果（2026-11-04）

- 59項Node單元、strict型別、production build、素材存在／來源／baked雜湊驗證通過。
- [角色QA](../../artifacts/video-layered/qa.json)61項、[整站QA](../../artifacts/video-layered/site/checks.json)84項通過，正常頁面無JS／HTTP錯誤。
- 原髮材質27,696個owned像素均有來源且原色一致，真正restmesh分層合成與canonical0差；4,085個固定中央臉像素0變化，1,038個blink差分僅限原眼罩。42色／二值alpha、無透明臉洞保持。
- 卷髮在真實圓形內中段峰值19.22／23.33px，實際travel17.02／20.03px，完整髮梢35.53／38.22px；圓內可見髮梢7.36／15.46px如實保留。髮梢可離開裁切，實際可見中段與開閉間隙獨立驗證，24個500ms窗口最少1,880個非眼區像素變化。
- 1440相位×八髮束及兩投影網格全部正面積、無退化／非有限座標。局部最低面積約束只在最壞3個頂點修正最多0.521px，不跳畫三角、不縮整束運動；[原始定位與修復掃描](../../artifacts/video-layered/mesh-area-projection.json)保留。
- 左／右投影117／199個原skin像素沿相同curl骨鏈運動，禁止進入臉、項鏈或透明背景；耳環整鏈與寶石共享pivot。根固定、長度約束、接縫、100輪同相位及60／120／144／240Hz共時刻像素一致通過，這不是實機高刷螢幕測量。
- 減少動態／wind0初始Worker=0；恢復只準備一次並重用cache，隱藏／離屏保留相位，過期結果／destroy不再繪製，Worker兩種實際故障回退正常。

### Production性能

同環境fresh單頁headless Chromium、1200×1000／DPR1、無CPU節流；穩定2500ms後取樣完整12000ms風週期，量測期間沒有截圖或其他瀏覽器工作。原生rAF與解除Chrome限幀分開記錄。

| 版本／排程 | 實際繪製／秒 | callback中位數 | p95 |
| --- | ---: | ---: | ---: |
| 原PR9／原生 | 60.00 | 2.2ms | 2.9ms |
| 本輪／原生 | 59.92 | 1.1ms | 1.5ms |
| 原PR9／不限幀 | 419.39 | 2.1ms | 2.5ms |
| 本輪／不限幀 | 793.61 | 0.9ms | 1.3ms |

[基線](../../artifacts/video-layered/baseline-performance.json)及[本輪](../../artifacts/video-layered/performance.json)均無運行中50ms長任務、JS／HTTP錯誤。常見每幀CPU約減半；不限幀值為容器吞吐，不能寫成實機793FPS。

[冷啟動](../../artifacts/video-layered/startup.json)另外量測，不藏在穩態數字中：預烘焙前動畫初始化最長主任務312ms，改後動畫95ms／減少動態101ms；仍有React／圖集解碼等初始化長任務，不能宣稱完全零卡頓。新鮮頁面Canvas ready約1.90秒（動畫，1 Worker）／0.66秒（靜態，0 Worker），等待時保留原poster；網路與實機會影響時間。[優化前原始資料](../../artifacts/video-layered/diagnostics/startup-before-bake.json)保留。

### 實際動畫輸出

[24秒GIF](../../artifacts/video-layered/portrait/animation_preview.gif)包含兩輪風與三次獨立眨眼，480張真實CSS圓形截圖，解碼480格均與共用調色盤來源一致；約2.25MB，平均RGB編碼誤差1.19／255，原始Canvas PNG不變。83時刻、10姿態及10錨點合計103筆映射，去重57張PNG、3,038,179 bytes；pose1／10及canonical休息SHA保持。

另提供[60fps審查影片](../../artifacts/video-layered/portrait/animation-60fps.mp4)：720張512²真實production CSS截圖、12秒、H264、2,134,884 bytes，FFprobe確認60/1與720frames，無瀏覽器錯誤。這是指定時間戳的實際程序化渲染，不插幀或換生成臉；編碼率不是捕獲當時即時FPS。H264有顏色損失，42色／alpha驗收仍以原Canvas資料為準。
