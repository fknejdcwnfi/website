# 暖白阅读与像素场景

本轮借鉴简洁产品界面的留白、暖白纸面与克制层级，保留网站自己的Minecraft暮色风景、蓝色页首、中英像素字体、八个章节目标、全部真实内容和Vermouth圆形动态人物。没有引入其他产品的品牌或聊天界面。新增独立思绪区见[思绪空间](thoughts.md)。

## 维护入口

- `src/features/profile/styles/themeTokens.css`集中字体、暖白表面、文字、强调色、细边框、圆角和阅读间距；在组件规则前加载。
- `creamScenic.css`直接维护现有页面外观；`journal.css`负责手记阅读。不要用新的末尾覆盖主题叠加另一套调色板。
- 桌面主要阅读区内距32px，手机18px；边框1px，面板／卡片／控件圆角16／14／10px。作品、手记和兴趣卡片采用实色纸面与低阴影，图片仍使用既有响应式资源。
- 手机作品使用逐项目布局，身份与状态在首行，说明与详情全宽阅读；保留表格、标题及列标题语义。页头使用实色蓝背景，滚动时文字不透底。
- `content/projectPresentation.ts`共享真实项目统计，React与静态HTML都使用它。项目数量、状态及文案来自原配置，不填充虚构内容。

人物仍默认动态，共用原有暂停／恢复选择；离屏和后台停止绘制。灯笼、晶体、标题入场和卡片反馈使用既有微动规则，外围装饰尊重减少动态偏好。原始人物像素、来源时钟、两帧缓存和气象层保持原实现，详见[场景指南](poetic-pixel.md)与[整理与像素微动](scenic-refactor.md)。

## 健壮性与验证

`referenceScene/browserSignals.ts`将可选`addEventListener`属性的读取也纳入异常边界：读取失败或部分注册失败时清理并尝试旧式监听。新增回归覆盖方法getter与清理getter异常、旧式注册／触发、幂等卸载及卸载后排队回调失效。这是故障注入发现的兼容性缺口，不将其描述为访客已遭遇的安全漏洞。

```bash
VITE_BASE=/ npm run build
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_reading_theme.py --url http://127.0.0.1:5180/ --output /workspace/work/reading-check
```

`verify_reading_theme.py`检查实色阅读层级、像素字体、八个章节目标、320–1680px布局、原人物节点、搜索、暂停及无JS原生阅读；原有界面、模块、故障注入和来源像素检查继续保留。Pages须单独构建`/website/`并指定其URL。性能观察应独占浏览器，不能将本地rAF或CPU时间换算成真实设备FPS或访客体验保证。

本轮结果与截图见[独立证据](../../artifacts/calm-pixel/README.md)。历史报告不改写为本轮通过记录；原始工程、源素材和既有历史入口保持。
