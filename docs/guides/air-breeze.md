# 橫向風阻與下垂髮束

2026-11-05：擁有者看過 PR #12 後明確指出「往上的潮水感」不對，要求自然環境中風吹頭髮的連貫感。本輪只處理髮動，不把啟動可靠性或測試項數當作美術完成的證據。

## 原因與變更

舊模型的 `fy=-load*80*flutter` 是始終向上的外力，而且同一個正風量控制全部髮束。即使風量連續，仍會把一整束頭髮推起再放下；延長波形只能把上浮變慢。

現在移除該上揚載荷。主風沿水平方向流過，阻力扣除髮束本身的速度；弱向下的殘餘載荷與原捲曲形狀的彈性保持下垂。竪向只保留很小的零均值擾動，沒有風越強就越向上的關係。主風保持較穩，局部 4 秒／3 秒橫流以不同髮束相位及沿弧長延遲形成中段彎曲、末端拖尾與回擺，避免所有束只追隨同一個起落波峰。

第一版只移除向上載荷後，可見橫向動作也減少；因此調整的是錯相橫流，而不是恢復竪向抛起。原來的根點、長度、曲率及非翻面約束、同一像素身份、獨立眨眼、圓形裁切及預烘焙載入繼續保留。風場改動後重新產生所有尺寸 Float32 快取，來源雜湊阻止舊快取配新程式。

## 驗收原則

- 以真正圓形內髮束的橫／竪軌跡、新舊畫面與時序對比判斷，不只統計變了多少像素。
- 新增水平髮束不被水平風無端托起的回歸，並檢查相鄰髮束不完全同相；真實捲髮因長度約束可有幾何上抬，不能要求所有節點 dy 都非負。
- 保持可見橫向擺動，不能以減小全部幅度或停動來消除潮水感。
- 固定五官、根點、長度、網格、二值 alpha、眨眼、循環接縫、減少動態與失敗恢復繼續檢查。

這仍是二維原始切片與受約束的髮帶。輪廓的小碎線、素材遮擋和反向風限制仍存在；不宣稱完整三維空氣動力學、逐根頭髮碰撞或已獲使用者審美確認。

## 重跑

```bash
node scripts/assets/export_baked_physics.mjs
npm run build
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_layered_portrait.py --url http://127.0.0.1:5180/ --output artifacts/air-breeze/qa.json
python3 scripts/qa/measure_portrait.py --mode native --url http://127.0.0.1:4173/website/ --output artifacts/air-breeze/performance.json
python3 scripts/qa/capture_portrait_video.py --url http://127.0.0.1:4173/website/ --output artifacts/air-breeze/portrait/animation-60fps.mp4
```

量測與新舊視覺證據位於 `artifacts/air-breeze/`。影片編碼率及容器運行測量不作使用者實體顯示器 FPS 保證。

## 實際畫面與測量

[新舊並列預覽](../../artifacts/air-breeze/comparison/side-by-side.gif)由同一素材與真實 renderer 生成，左為 PR #12、右為本輪；10fps、12 秒，只作動作對比。[逐秒新畫面](../../artifacts/air-breeze/comparison/mode-1.png)與[舊畫面](../../artifacts/air-breeze/comparison/mode-0.png)分開保留。腳本 `scripts/qa/review_air_breeze.mjs` 以固定 PR #12 commit 在暫存資料夾重建舊求解器，不將它留在runtime；`scripts/qa/capture_air_breeze_comparison.py`可重做比較。

[相同綁定的 720 時刻診斷](../../artifacts/air-breeze/motion-review.json)中，各髮束可見中段竪向速度的兩兩相關絕對值平均由 0.962 降至 0.528，支持減少共同起落的判斷。左／右卷髮可見節點的平均位置橫向行程由 4.01／9.92 變為 4.44／8.57 像素；梢橫向行程由 8.94／24.61 變為 10.18／21.61。整體竪向位移 RMS 由 0.914 變為 0.999，不能聲稱所有竪向運動都減少；重點是去掉統一向上載荷並改變動作的方向與時序。這些數值不是自然感的評分，畫面仍需人工審視。

獨立畫面檢查可見左右卷髮各自側擺，未見完整舊卷髮留在原位形成雙份；仍有局部淺色碎線與疊線。水平發束fixture的上托峰值由舊版約7.51像素變為0，另有相鄰發束不同步及慣性延遲的回歸。

## 完整驗證

62 項 Node 單元、strict TypeScript／production build、來源／衍生素材驗證、[角色79項](../../artifacts/air-breeze/qa.json)及[整站84項](../../artifacts/air-breeze/site/checks.json)通過。原可見行程門檻未降低；左右卷髮最大可見中段行程6.85／13.75像素，4,085核心臉像素0改變，全部網格0翻面，循環邊界前後相隔2ms的最大節點位置差0.02045像素、速度差0.000198。

[正式播放器60fps編碼預覽](../../artifacts/air-breeze/portrait/animation-60fps.mp4)由720張實際CSS圓形截圖構成，並非插幀或逐臉切換。眼角t10s淺色部分與舊版對照後為既有眼白／高光，前景細髮仍連接髮束；核心臉0改變不代表所有眼周都0遮擋。

[Production量測](../../artifacts/air-breeze/performance.json)採單頁Chromium無CPU節流，穩定後測完整12秒，期間無其他瀏覽器或截圖：59.65次繪製／秒，callback中位1.1ms、p95 1.5ms，穩態50ms長任務0個。沒有測使用者實體高刷新顯示器。
