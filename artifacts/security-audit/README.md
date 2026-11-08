# 2026-11-08 多维审计证据

基线：`7258c9379bb5426bf8eb06a51dc1365f16a0fba5`。[审计报告](../../docs/reports/2026-11-08-audit.md)区分已复现发现、修复、实际测量和限制。保留现有页面及人物来源。

| 最终验证范围 | 实际结果 | 证据 |
| --- | --- | --- |
| Node、严格TypeScript、Vite根路径 | 126项测试；类型与构建通过 | [build.log](build.log) |
| CSP、兼容故障、静态快照、短视口、三个历史入口 | 109项浏览器检查 | [browser/checks.json](browser/checks.json) |
| 边框、搜索、作品、无JS | 199项浏览器检查 | [ui-checks.json](ui-checks.json) |
| 个人模块与隔离合成配置 | 269项浏览器检查 | [profile-checks.json](profile-checks.json) |
| 奶油主题、图片、字体、导航 | 144项浏览器检查 | [cream-checks.json](cream-checks.json) |
| 原场景、来源、入口、偏好及故障恢复 | 134项浏览器检查 | [scene-checks.json](scene-checks.json) |
| Pages独立`/website/`构建 | 51项浏览器检查 | [pages-base.json](pages-base.json) |

全部通过：根路径855项、Pages51项，共906项浏览器检查；Node126项另计。合成账号／故障／攻击探针只在隔离测试中，未进入发布配置。正常CSP与故意阻挡探针分别记录；等待条件使用显式函数，未为测试放宽策略。

其他原始证据：

- [内容审查](content-review.json)、[生命周期复现](runtime-review.json)：区分受信任配置问题、原模块模拟、源码发现及最终浏览器回归。
- [依赖公告](dependency-advisories.json)：70个锁定版本，0查询错误／0命中；非完整npm audit或未知漏洞保证。[锁文件元数据](lockfile-integrity.json)单独检查来源与SHA-512声明。
- [有限凭证模式](credential-patterns.json)：2,007份可达历史blob及扫描时当前文件无匹配，不覆盖所有格式、不输出秘密。
- [来源与产物](source-integrity.json)：57份指定素材／像素／时钟／天气文件一致，97份public文件与dist字节一致。生命周期基础设施有明确修改。
- [资源优化前](resources-before.json)／[优化后](resources-after.json)：六张图实际请求11,365,490→8,456,376bytes，减少25.6%。[解码复核](pixel-equality.log)确认六对RGBA一致；[来源清单](../../public/assets/pixel-ui/optimization-manifest.json)记录PNG／WebP哈希与参数。
- [DPR1前](performance-before.json)／[DPR1后](performance-after.json)／[DPR4](performance-after-dpr4.json)：独立单浏览器本地12秒采样，无截图或并行编码。未声称CPU加速、访客CWV、真实设备内存或物理FPS；其后仅修正打开搜索时的高度约束。
- [资产验证](assets-verify.log)及[既有衍生核对](assets-check.log)。标准库验证进入既有CI命令；Pillow仅用于完整解码复核。
- [初始文档检查](documentation-links.json)／[持续结构检查](repository-structure.json)：冻结文档7处历史旧路径单列，其余缺失及跟踪临时输出导致失败；不验证外链和片段。

本目录验证本地生产构建。提交后的CI、Pages和官方Sites发布需分别确认，不能由本地测试推断部署成功。
