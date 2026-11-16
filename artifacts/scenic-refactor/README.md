# 仓库整理与微动验证

基线`1aee28a`。严格TypeScript、两种base生产构建和159项Node测试通过；资源／完整字体／响应式nearest逐像素校验及18项仓库CLI回归通过。[汇总](validation.json)核对104份公开文件与产物一致，冻结原工程、人物源码／像素与天气未改。

实现入口见[本轮指南](../../docs/guides/scenic-refactor.md)。

| 浏览器范围 | 实际通过检查 |
| --- | --- |
| [根路径微动](motion.json)／[Pages微动](pages-motion.json) | 各35 |
| [根路径人物](default-motion.json)／[Pages人物](pages-default-motion.json) | 各44 |
| [根路径奶油UI](cream.json)／[Pages奶油UI](pages-cream.json) | 各155 |
| [边框、搜索与作品](ui.json) | 199 |
| [个人模块及隔离合成夹具](profile.json) | 276 |
| [根路径手记](journal.json)／[Pages手记](pages-journal.json) | 各34 |
| [完整原人物场景](scene.json) | 134 |
| [CSP及故障边界](hardening.json) | 111 |

合计1256项浏览器检查，另有[23项历史入口smoke](historical-routes.json)。外围只有两盏灯笼和一枚晶体常驻微动，卡片与标题使用小幅transform/opacity，背景和实际人物viewport不新增动画。暂停／恢复、刷新、存储不可用、减少动态、后台、缺失Observer、键盘、无JS和320px布局通过；人物Canvas身份与来源相位保持。

[结构核对](source-structure.json)：六PNG移出公开目录11,365,490bytes，但全部原字节保留，对应full WebP也未重编码；历史CSS由懒加载入口单独请求，base.css由8,290降至1,144bytes。当前维护说明收敛，页面骨架、搜索、图标与导航hook分工，Node自动发现测试。

[相同条件对照](comparison.json)：完整产物47,014,966→41,250,760bytes；主CSS77,880→75,084bytes，gzip9 17,876→16,771bytes。新增微动、hook与响应式属性令HTML／主JS略增，不能把原PNG移出目录当作首页请求减少。

测量分别用全新375px／1440px、DPR1／2上下文，滚动查看全部五张卡图，记录实际选择和encoded字节。原五图合计6,814,838bytes；375px DPR1／2均为1,306,338bytes，1440px DPR1为1,803,958bytes、DPR2为4,853,600bytes。full fallback与高DPR候选保留。派生为nearest采样后的无损编码，不保留每个原尺寸像素；人物与全屏背景未缩采样。[手机实图](mobile.png)和[默认首页](desktop.png)供目视复核。

公开目录守卫先验证显式路径、文件类型和regular file，再核对产物清单与公开字节。实际构建发现三个已有物理数据`.bin`，现以精确路径保留，而非允许任意二进制；新增真实清单测试覆盖此兼容边界。CSP没有放宽。[依赖记录](security-dependencies.json)只查询6个指定版本，均无匹配公告，不代表全部依赖或网站绝对安全。

微动新QA最初在resize后立即读到旧画布宽度，现等待既有rAF布局测量完成再验证；不是隐藏overflow。响应式图像检查验证合法srcset候选、解码与比例，不再误要求naturalWidth等于完整原图宽度。DPR故障测试只比较resolution查询，区分新增的系统减少动态查询；CDP模拟不等同物理显示器事件。

[独立采样](performance.json)：单个1440×1100/DPR1 Chromium，静置2秒后12秒，约59.95次rAF回调／秒、49.88次来源换帧／秒；callback中位4.5ms、p95 6.9ms、最大13.1ms，无browsererror。此为本地单次条件，不承诺访客速度、物理显示帧率或固定60fps。GitHub CI与正式部署另外核实。
