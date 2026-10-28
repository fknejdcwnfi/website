# 貝爾摩德｜原始畫風 10 幀頭髮風動＋眨眼分鏡（Refined 版）

這是網站開發用的 10 張**關鍵姿態參考**，不是已完成的最終逐像素動畫。第 1 / 10 幀仍沿用原圖作為靜止起止基準；第 4 / 5 幀已改為**高清精修版**，不再使用先前較模糊的裁切分鏡，現在可更穩定地用作「半閉眼 / 完全閉眼」的高質量眨眼參考。其他幀源自先前生成的高清同風格肖像。

由於整套幀仍然是「原圖 + 多張生成參考」的組合，臉部與髮絲細節依然不保證逐像素一致，因此它們最適合作為 **Codex / 前端動畫系統的關鍵姿態參考**，而不建議直接當作最終逐幀動畫播放。

**所有幀共同不變的約束（每幀均須繼承）：**

Use the attached ORIGINAL character image as the single strict identity and composition reference. Preserve the same platinum-blonde woman, exact facial geometry, blue eyes, distinctive eyebrows, subtle confident smile, bangs, jewelry, pendant, shoulders, lighting, navy background, framing and 1:1 square crop. Preserve the ORIGINAL anime illustration style with crisp hand-drawn linework; NOT pixel art, NOT Minecraft, NOT 3D, NOT a redesign. Lock camera, face, jaw, nose, mouth, proportions, necklace attachment and torso. Change ONLY physically plausible hair strands, hair tips, eyelids for the blink, and tiny earring angles. Keep hair roots anchored. No camera zoom or drifting, no identity change, no color shift, no extra accessories, no added text.

## 十幀與逐幀 Prompt

### Frame 01 — 初始靜止
- 圖片：`frames/frame_01.png`
- 風力（示意）：`0.00`；眼睛開合（1 全開、0 全閉）：`1.00`
- 動作：眼睛完全睜開；嘴角微笑；髮束位置嚴格等同原圖；耳環和項鏈靜止。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Calm baseline: no motion, full open eyes. No pixelation, no face movement, no text."

### Frame 02 — 微風開始
- 圖片：`frames/frame_02.png`
- 風力（示意）：`0.18`；眼睛開合（1 全開、0 全閉）：`1.00`
- 動作：畫面右側的外層髮尾開始輕輕抬起，少量前髮偏移；眼睛保持睜開。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. A first delicate breeze: a few right-side outer hair tips gently lift and flow; eyes open. No pixelation, no face movement, no text."

### Frame 03 — 風力增強
- 圖片：`frames/frame_03.png`
- 風力（示意）：`0.45`；眼睛開合（1 全開、0 全閉）：`1.00`
- 動作：右側多束長髮向畫面右方逐漸流動，髮根固定、髮尾延遲；眼睛仍然睜開。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Gentle breeze grows: separated strands on the right begin following the wind, with slight trailing motion; eyes open. No pixelation, no face movement, no text."

### Frame 04 — 準備眨眼（Refined）
- 圖片：`frames/frame_04.png`
- 風力（示意）：`0.65`；眼睛開合（1 全開、0 全閉）：`0.45`
- 動作：保持同一張臉和固定視線，雙眼眼瞼平滑下降至約半閉；髮束持續被風吹向右側；耳環稍微滯後。此幀已精修為高清版本，適合作為半閉眼關鍵姿態。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Maintain elegant moving hair while both eyelids lower smoothly to a refined half-closed blink; bright blue irises still partially visible, identity fixed, hair flowing right, earrings slightly delayed. No pixelation, no face movement, no text."

### Frame 05 — 自然閉眼（Refined）
- 圖片：`frames/frame_05.png`
- 風力（示意）：`0.70`；眼睛開合（1 全開、0 全閉）：`0.00`
- 動作：雙眼完全閉合，保留原來的眉眼位置、嘴角與臉部輪廓；長髮繼續流動，耳環緩慢擺動。此幀已精修為高清版本，適合作為完全閉眼關鍵姿態。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Natural full blink in refined high quality: both eyelids softly closed, eyelashes visible, same slight smile, while long blonde hair continues flowing right in the breeze and earrings sway subtly. No pixelation, no face movement, no text."

### Frame 06 — 重新睜眼
- 圖片：`frames/frame_06.png`
- 風力（示意）：`0.75`；眼睛開合（1 全開、0 全閉）：`1.00`
- 動作：雙眼迅速重新睜開，表情不變；風仍持續，臉和身體的位置不變。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Eyes reopen naturally after blink, same gaze and smile; hair still flows and earrings slightly lag behind. No pixelation, no face movement, no text."

### Frame 07 — 風力高峰
- 圖片：`frames/frame_07.png`
- 風力（示意）：`0.90`；眼睛開合（1 全開、0 全閉）：`1.00`
- 動作：右側前後長髮、肩旁髮尾出現較明顯的自然波動；眼睛完全睜開；飾物輕微擺動。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Slightly stronger gust: multiple independently flowing hair locks, tips trailing farther than roots, eyes fully open. No pixelation, no face movement, no text."

### Frame 08 — 風向輕微變化
- 圖片：`frames/frame_08.png`
- 風力（示意）：`0.50`；眼睛開合（1 全開、0 全閉）：`1.00`
- 動作：前髮與側髮開始回彈、局部髮束改變方向；眼睛保持睜開，五官及輪廓不變。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Wind shifts gently and strands rebound with inertia, several side locks move back, eyes open. No pixelation, no face movement, no text."

### Frame 09 — 風力減弱
- 圖片：`frames/frame_09.png`
- 風力（示意）：`0.20`；眼睛開合（1 全開、0 全閉）：`1.00`
- 動作：長髮逐漸落回自然位置，只留下少量髮尾擺動；耳環慢慢停止。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Wind subsides; long curled hair slowly settles with damping, earrings come to rest, eyes open. No pixelation, no face movement, no text."

### Frame 10 — 回到原始狀態
- 圖片：`frames/frame_10.png`
- 風力（示意）：`0.00`；眼睛開合（1 全開、0 全閉）：`1.00`
- 動作：與第 1 幀原圖完全一致，雙眼睜開，頭髮回到初始形狀，便於循環。
- English incremental prompt: "Same original anime character, perfectly consistent face and framing. Return exactly to original unchanged pose: fully open eyes, original hair silhouette, quiet baseline for seamless loop. No pixelation, no face movement, no text."

## 分鏡時間軸（可供 Codex 使用）

| 幀 | 建議時間 (ms) | 風力 | 眼睛開合 |
|---|---:|---:|---:|
| 01 | 0 | 0.00 | 1.00 |
| 02 | 230 | 0.18 | 1.00 |
| 03 | 460 | 0.45 | 1.00 |
| 04 | 630 | 0.65 | 0.45 |
| 05 | 740 | 0.70 | 0.00 |
| 06 | 850 | 0.75 | 1.00 |
| 07 | 1020 | 0.90 | 1.00 |
| 08 | 1300 | 0.50 | 1.00 |
| 09 | 1570 | 0.20 | 1.00 |
| 10 | 1890 | 0.00 | 1.00 |

循環至 2300 ms 後回到第 1 幀。此時間表只為風格預覽提供關鍵姿態；真正眨眼應在約 150–250 ms 的短時間內快速閉合及重新睜開。

**品質限制：** 這仍是一套關鍵姿態參考，不是最終逐像素一致動畫。真正交付網站時，應基於這些幀與原始角色建立統一圖層 / rig，避免直接逐幀輪播造成閃爍。
