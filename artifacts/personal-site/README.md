# 現行完整個人網站驗證

這裡保存目前居中、透明無框圓形Vermouth與Minecraft像素風個人網站的完整頁面驗證，並非早期人物單頁。

- [hero.png](hero.png)：1440px桌面首屏，中軸圓形人物、標題與主要入口。
- [desktop.png](desktop.png)：完整桌面頁面。
- [mobile.png](mobile.png)：390px手機完整頁面；DPR1／2皆另作像素對齊檢查。
- [no-javascript.png](no-javascript.png)：停用JavaScript後的完整個人內容與相同圓形靜態肖像。
- [checks.json](checks.json)：最新完整網站檢查狀態、四種寬度、圓形／像素對齊測值及預期故障清單。
- [目前角色與效能](../flowing-hair/README.md)：持續微風、獨立眨眼、原生／不限幀實際量測、逐幀圖集與圓形GIF。

截圖使用減少動態以固定畫面；正常播放、離屏／可視續播及12秒以上持續繪製會另外檢查。Canvas的二值alpha、固定調色盤與瀏覽器圓形裁切的邊緣抗鋸齒分別驗證，不將兩者混為一談。

```bash
npm run build
npm run preview
python3 scripts/qa/verify_personal_site.py --url http://127.0.0.1:4173/website/
```

擁有者已授權自動合併及更新，通過檢查後依main→GitHub Actions→Pages發佈。歷史數字、畫面與舊的暫不發佈指示不代表目前版本。
