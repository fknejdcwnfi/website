# 阅读与默认动态验证 · 2026-11-15

本轮范围为第二篇手记、未知日期、文章分文件与共享日期展示、预建搜索索引，以及作者要求的新访客默认人物动态。原稿和可识别标识未进入本目录。基线为`2a3c3b0`，严格TypeScript、两种base生产构建及148项Node测试通过；资源、字体完整轮廓／度量、18项仓库CLI回归通过。[汇总](validation.json)核对99份公开资源与产物逐字节一致，原工程、人物原画、renderer与天气素材未改。

实现边界见[本轮指南](../../docs/guides/reading-motion.md)。

| 本轮生产预览 | 实际通过检查 |
| --- | --- |
| [根路径手记](journal-root.json)／[Pages手记](journal-pages.json) | 各34 |
| [根路径默认动态](motion-root.json)／[Pages默认动态](motion-pages.json) | 各44 |
| [奶油色UI](cream.json) | 155 |
| [搜索、边框与作品](ui.json) | 199 |
| [个人模块与独立合成夹具](profile.json) | 276 |
| [完整场景](scene.json) | 134 |
| [CSP与故障边界](hardening.json) | 111 |

合计1031项浏览器检查。默认动态检查包含普通／OS减少动态／媒体API缺失或抛错／存储不可用／旧选择首访的真实人物像素与来源时钟变化；关闭天气后仍观察到人物运动。实际暂停点击前最后一帧与暂停画面的hash、elapsed一致，恢复保持Canvas与相位。明确暂停后刷新不下载视频或图集；加载失败且自动重试耗尽后，回退预览仍可暂停／恢复，重试按钮保留。固定`t`和无JS行为仍可用。

独立复审找到失败回退丢失暂停按钮的问题，已修复并纳入44项检查。搜索新增useMemo后，旧真实IME回调harness缺少对应dispatcher，已补按依赖缓存的模拟并保留原IME／229／普通键盘断言。about:blank无法访问storage的QA预置已改为局部try/catch，不屏蔽应用错误。

DPR检查区分模拟条件：CDP直接改变DPR未稳定派发MQL事件，实际DPR4及2864×2136画布通过resize fallback验证；读取原查询状态后恢复viewport，观察到legacy监听重绑。没有将此视为物理显示器DPR事件证明，也没有为模拟改应用。

[搜索微基准](search-benchmark.json)对相同10条索引、8类查询交错采样7×2000次：重复查询CPU中位36.02→1.10µs，索引准备成本不在重复查询采样内。这不是浏览器输入延迟或访客速度保证。[体积记录](build-comparison.json)以相同gzip9比较：新增文章和控件使HTML56,103→61,171bytes、主JS306,514→310,621bytes；没有宣称网络载荷缩小。忠实字体子集25,680→28,280bytes，完整字体与许可证保留。

[独立场景采样](performance.json)：单个Chromium、1440×1100/DPR1、静置2秒后12秒，约59.08次rAF回调／秒、49.17次来源换帧／秒，callback中位4.5ms、p95 5.5ms、最大48.7ms，无browsererror。存在长callback，不能称为固定60fps或真实访客指标。来源12.5fps锚点与50fps估计过渡的含义不变。

[默认人物与暂停按钮](default-hero.png)、[新手记卡片](journal-card.png)、[手机阅读](journal-mobile.png)是本轮实际浏览器截图。旧审计记录保持历史范围；GitHub CI与正式部署另行核实，不从本地检查推断。
