# Minecraft-inspired 單一像素美術母版

使用提供的原 frame_000 作唯一圖片參考，重繪成具明確像素簇、階梯輪廓與材質方塊的二維遊戲美術。原工具輸出保留在 generated_images；本目錄保存採用的母版、完整提示和來源SHA。

此母版已透過`motion-fields/`的16份受約束源姿態字段接入網站，全部160個派生樣本只使用同一母版，不輪播獨立生成臉。新細節與幾何不是原GIF逐像素相同，也不代表恢復來源沒有的資訊。原16×80ms／1280ms及125樣本節奏保持；無翻折和源時鐘需分別核驗。完整重跑見`docs/guides/minecraft-scenic-rebuild.md`。

`closed-eye-master.png`是同一母版的完全閉眼局部素材參考。只有雙眼區可用於合成；其它生成像素須全部丟棄，以保留唯一角色母版。閉眼來源參考為原frame007，時序仍由原工程決定。具體提示與建議擷取ROI見closed-eye-provenance.json。
