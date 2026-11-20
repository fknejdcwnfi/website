# 思绪与日志、搜索索引与默认动态

本轮按作者要求加入《学会与时俱进》，保留大学适应、持续学习、AI变化与责任的个人思考，移除姓名、编号和学校等识别信息。原稿未注明日期，页面不补造日期。私人DOCX不进入公开仓库、产物、测试或证据；隐私核对在公开目录外完成，不用真实标识当作公开测试字符串。

## 结构与搜索

当前日志和思绪统一存放在[`content/writing/`](../../src/features/profile/content/writing/)，[聚合入口](../../src/features/profile/content/writing/index.ts)显式确定展示顺序；缺少原稿日期的记录继续无日期。共享日期显示和内容选择分别位于[`writingPresentation.ts`](../../src/features/profile/content/writingPresentation.ts)和[`selectors.ts`](../../src/features/profile/content/selectors.ts)。原生全文阅读、无JS正文以及原文章锚点均保持。

[搜索索引](../../src/features/profile/content/searchIndex.ts)在每次挂载中首次打开搜索时准备规范化文本。后续输入只拆分查询并匹配，到8条结果即停止。保留字面匹配、原顺序、大小写行为和旧 `searchSite` 接口。搜索在当前页面内复用索引。全文仍随静态HTML和运行时代码提供，关闭JavaScript后继续可以阅读。

## 默认人物动态

作者明确要求默认动态，因此新访客自动播放，不再由系统减少动态设置决定初始静止。读者可用“暂停动态／开启动画”控件撤销，新的本地键`vermouth-scene-motion`记录`dynamic/static`。旧键的`false`原本表示跟随系统，不迁移为明确暂停。

[共享选择逻辑](../../src/features/referenceScene/motionPreference.ts)用于parser入口、React和ScenePlayer。构建把自包含读取表达式嵌入自有启动脚本，再生成CSP哈希；没有eval、远程脚本或放宽策略。存储不可用时，首次仍播放，本页暂停选择仍有效。首次明确静态访问不下载视频／图集；已接手的高清场景暂停时保留当前画面和相位，恢复使用同一播放器与资源。加载失败的预览也保留暂停／开启选择，重试按钮独立存在。

固定`t`检查、离屏和后台暂停继续生效；原图、renderer、来源动作、雪樱及自适应分辨率不变。默认自动播放不能保证浏览器允许影片自动播放或所有设备达到固定帧率；入口天气、预览和失败回退继续提供渐进显示。

## 验证范围

```bash
npm run build
npm run assets:verify
npm run assets:font:check
python3 scripts/qa/verify_writing.py --url http://127.0.0.1:5180/ --output work/reading-motion/writing
python3 scripts/qa/verify_default_motion.py --url http://127.0.0.1:5180/ --output work/reading-motion/motion
```

两种托管base、默认真实帧变化、显式暂停与刷新、未知系统API、入口接手、原人物像素和既有UI分别检查。搜索微基准是同数据的本地CPU计算成本；单次场景采样只代表本地Chromium条件，不替代真实访客指标或物理显示帧率。实际结果见[本轮独立证据](../../artifacts/reading-motion-20261115/README.md)。
