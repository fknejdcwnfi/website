# 穩定的圓形像素肖像

2026-11-06，擁有者明確拒絕PR #16整張圖的扭曲／時空波動感，要求恢復原來圓形並移除背景。這是最新要求，取代圈外景色、飄雪、1.28秒整圖姿態重定向及其首屏影片。

## 結果與邊界

首頁是最大534CSS像素、無描邊無陰影的圓形人物。Minecraft美術和716×534輸出保留；人物周圍背景完全透明，沒有富士山／櫻花外景、雪層或舊動畫影片。網站導覽、介紹、真實作品和聯絡保持。

臉、頭頂、前額／胸前捲髮、脖子、肩膀、耳飾和項鏈來自同一固定圖層，沒有平移、縮放、旋轉或位移場。僅兩塊獨立的**後側頭髮**在固定圖層後方做小角度剛體輕擺，最大0.022rad，沒有拉伸或形狀變化；12秒週期，各髮束同一風向且稍有錯相。局部眼瞼沿已使用的24秒獨立時鐘眨眼，事件在4.4／11.3／20.3秒，每次280ms。這是克制的局部動態，不宣稱大幅風動或與來源GIF所有幾何完全相同。

之前通過無翻折檢查不能證明觀感自然。舊整圖光流、位移字段、160幀圖集及boot.mp4均不在現在首頁的依賴／請求鏈中，不能以調低原整圖變形幅度再次恢復它。

## 素材與身份保護

`assets/generated/calm-circle/`保存AI輔助的透明選擇及清髮參考與提示詞。**只取它們的二值alpha選擇，不使用生成的臉／皮膚RGB**；所有可見人物色彩仍取自已採用的Minecraft母版。選擇圖的alpha多為254，使用>=128門檻，不用==255。原ZIP、PNG和歷史資產不改寫。

目前只選位於固定頸肩輪廓外的後側髮束，沒有移動胸前髮束，也沒有用不完整skin填補。空出的區域是真正透明空氣，不會露出靜止副本；完整臉部多邊形、耳飾與脖子有額外保護。根處重疊藏於固定頭髮後方。後側髮層先畫、固定人物層後畫、眼瞼最後畫；每幀清空透明畫布，避免黑底或殘影。

`canonical.png`由同一零角度圖層組合建立，離線RGBA逐像素相等。所有PNG直接無損RGBA編碼，不再二次量化。動態圖層僅在允許動畫時延後載入，減少動態只需首幀；取消／逾時／重試／離屏與隱藏保相位沿用共享ScenePlayer。

## 結構與重跑

```text
src/features/calmPortrait/          新預設：定義、生成描述、局部rigid renderer及純motion
src/features/referenceScene/       共用可見性播放器／圓形UI；舊source renderer為歷史
public/assets/calm-circle/          canonical、fixed plate、兩後髮、眼瞼與manifest
assets/generated/calm-circle/       選擇參考與來源提示詞，非替換人物RGB
scripts/assets/export_calm_portrait.py  單母版取色、選擇alpha與無損圖層
scripts/assets/verify_calm_portrait.py  CI標準庫來源／描述／檔案驗證
artifacts/calm-circle/              當輪畫面、穩定區域／整個固定層像素及效能
```

```bash
python3 scripts/assets/export_calm_portrait.py
npm run build
npm run assets:verify
npm run preview -- --host 127.0.0.1 --port 5180
python3 scripts/qa/verify_calm_circle.py --url http://127.0.0.1:5180/website/ --contract public/assets/calm-circle/manifest.json --canonical public/assets/calm-circle/canonical.png
python3 scripts/qa/capture_calm_circle.py --url http://127.0.0.1:5180/website/
# 其它browser與截圖工作結束後獨立量測：
python3 scripts/qa/capture_calm_circle.py --url http://127.0.0.1:5180/website/ --measure
```

`?view=scene`隔離現在的圓形，`?t=4500`檢查局部閉眼。舊`motion=original`不會啟用已拒絕的整圖動畫。`?view=portrait`仍是明確歷史肖像入口，不是現在預設。

## 本輪證據

- 83項Node單元、strict TypeScript／production build、來源／新圖層hash驗證通過。
- [整站72項](../../artifacts/calm-circle/site/checks.json)通過，涵蓋9個時刻的臉／頸肩／項鏈保護區與**整個固定plate（眼瞼除外）RGBA零差**、局部變化上限、真實動態像素、無舊景色／影片／圖集請求、減少動態、隱藏／離屏、錯誤重試、手機及無JS。
- [12秒實際圓形預覽](../../artifacts/calm-circle/preview/animation.mp4)為534×534 CSS截圖、720張／60fps編碼，控制時間只用於重複檢視；不冒稱物理螢幕量測。影格含兩次局部眨眼，固定圖層始終不動。
- [獨立production性能](../../artifacts/calm-circle/performance.json)：Chromium1440×1100／DPR1、2秒穩定後獨占12秒、無截圖或並行瀏覽器，720次繪製（約60／秒），callback中位0.1ms／p95 0.2ms／max1.6ms，無browsererror。實際使用者螢幕更新率未量測。

所有現在使用的五份PNG合計約391KB，沒有Worker、整圖位移場或大型160幀圖集。頭髮幅度刻意保持很小；本次承諾是穩定、局部的肖像動態，不宣稱恢復大幅飄髮或完成三維物理。
