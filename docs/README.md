# 文件入口

当前网站采用暮色风景、蓝色页首、圆角奶油色面板和自托管中英像素字体；真实内容、搜索、导航和无JS页面由同一配置驱动。默认人物是`poeticPixel`原场景与独立雪樱，使用共享圆形播放器；旧发束物理、透明近景和其他主题属于历史实现。

第一次维护先读根目录[README](../README.md)、[AGENTS](../AGENTS.md)，再按下表进入具体职责。用户最新要求优先；历史文档里的“当前”“正式”只描述当时版本。

## 当前指南

| 文件 | 负责的范围 |
| --- | --- |
| [仓库维护](guides/repository-maintenance.md) | 目录责任、默认加载链、日常检查、历史与发布边界 |
| [2026-11-08多维审计](reports/2026-11-08-audit.md) | 可复现发现、修复、无损优化、实测与剩余验证范围 |
| [奶油色风景界面](guides/cream-scenic-ui.md) | 当前外观、桌面双侧栏、移动布局及页面装饰 |
| [边框、搜索与作品](guides/ui-consistency.md) | 统一边框、键盘搜索、真实项目详情与静态一致性 |
| [个性化模块](guides/profile-modules.md) | 社交、兴趣、游戏的配置、可选资料及独立夹具 |
| [高清圆形场景与雪樱](guides/poetic-pixel.md) | 唯一默认人物、原始来源、96色、像素重建、入口与场景QA |
| [工具入口](../scripts/README.md) | 当前构建、资源、浏览器验证及独立输出命令 |
| [证据索引](../artifacts/README.md) | 各轮实际验证的范围与历史证据区别 |
| [决策记录](decisions.md) | 实现被采用或取代的理由与授权历史 |

当前源工程见[fuji-wind](../reference-projects/fuji-wind/README.md)；字体来源与许可证见[Fusion Pixel登记](../public/fonts/FusionPixel-SOURCE.txt)。提交和协作规则见[CONTRIBUTING](../CONTRIBUTING.md)，其中旧角色实现说明应结合本索引和最新AGENTS阅读。

## 历史实现指南

文件保留原位以便追溯，不作为当前主题、人物管线或最新验收结果。当前实现和命令以表中“当前指南”为准。

| 阶段 | 保留文件 |
| --- | --- |
| 先前像素界面 | [简约像素界面](guides/pixel-minimal-ui.md)、[木牌与暮色像素界面](guides/pixel-world-ui.md) |
| 先前逐帧和场景展示 | [原动画像素转制](guides/faithful-source-pixels.md)、[Minecraft场景重建](guides/minecraft-scenic-rebuild.md)、[参考GIF重建](guides/reference-gif-rebuild.md)、[固定人物小幅后发](guides/calm-circle.md) |
| 旧发束与近景管线 | [影片发束重建](guides/video-layered-rebuild.md)、[参考版面与物理](guides/reference-rebuild.md)、[持续风动](guides/reliable-motion.md)、[自然风恢复](guides/natural-wind-recovery.md)、[轻柔风](guides/air-breeze.md)、[参考风动](guides/reference-wind.md)、[Living Portrait](guides/living-portrait.md) |
| 早期综合资料 | [旧开发指南](guides/development.md)、[旧个人网站指南](guides/personal-site.md)、[旧素材清册](guides/asset-inventory.md)；其中的来源和权利记录继续保留，当前入口已在上方列明 |

## 历史与冻结资料

[docs/archive/](archive/)保存最初anime／voxel阶段文件；[仓库archive](../archive/README.md)保存移出public的历史runtime与原始证据。这些目录不作为Vite公共目录发布。

| 历史文件 | 原用途 |
| --- | --- |
| [项目章程](archive/01-project-charter.md) | 最初范围与非目标 |
| [动画规格](archive/03-animation-spec.md) | 原十关键姿态与动作要求 |
| [架构](archive/04-architecture.md) | 原播放器及Stage路线 |
| [Codex交接](archive/06-codex-handoff.md) | 早期代理操作范例 |
| [QA清单](archive/07-qa-checklist.md) | 早期验收流程 |
| [图层计划](archive/09-layer-plan.md) | 原anime图层／clean plate研究 |
| [像素舞台](archive/10-pixel-stage.md) | 已封存voxel方案及当时实测 |
| [PR6风动与量测](archive/14-reference-wind-pixel-world.md) | 旧2300ms风动与当时采样 |
| [PR6肖像契约](archive/15-living-portrait-reference-timeline.md) | 新圆形展示之前的契约 |
| [PR7持续微风](archive/16-gentle-portrait.md) | 首次12秒微风／24秒眨眼及当时量测 |

[docs/reference/](reference/)保持逐字节不变。其README有7处沿用旧位置的链接；为保留原文，不在冻结文件内修复，阅读时使用以下映射：

| 原链接目标 | 当前可读入口 |
| --- | --- |
| `01-project-charter.md` | [历史项目章程](archive/01-project-charter.md) |
| `03-animation-spec.md` | [历史动画规格](archive/03-animation-spec.md) |
| `04-architecture.md` | [历史架构](archive/04-architecture.md) |
| `05-development.md` | [当前仓库维护](guides/repository-maintenance.md)；[旧开发实现](guides/development.md)另保留 |
| `06-codex-handoff.md` | [历史交接](archive/06-codex-handoff.md) |
| `08-decisions.md` | [决策记录](decisions.md) |

## 维护规则

改变行为、目录责任或发布流程时同步对应指南与CHANGELOG；不通过重写历史证据来更新结论。相对链接须从所在文件可打开，冻结资料的已知旧链接单独记录。截图、检查数量和性能数字只用于它们实际记录的提交与运行条件，不能替代新一轮验证。
