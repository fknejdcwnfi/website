# 2026-11-13 复审证据

固定基线`012181f4cb983e0ac58ab727e6b50152162dc019`。[报告](../../docs/reports/2026-11-13-audit.md)解释已复现发现、修复及限制；六个专项agent与主代理交叉复核，旧轮结果不代替本轮验证。

| 最终检查 | 实际通过数量 | 证据 |
| --- | --- | --- |
| Node、严格TypeScript、Vite | 137项Node，类型／根路径构建通过 | [build.log](build.log) |
| 仓库CLI | 18项Python回归 | [repository-tests.log](repository-tests.log) |
| UI／搜索／作品 | 199项浏览器断言 | [ui-checks.json](ui-checks.json) |
| 个人模块／隔离配置 | 269项 | [profile-checks.json](profile-checks.json) |
| 主题／实际lazy图／字体 | 150项 | [cream-checks.json](cream-checks.json) |
| 场景／入口／像素／恢复 | 134项 | [scene-checks.json](scene-checks.json) |
| 上轮安全／兼容用例重新执行 | 109项 | [hardening-checks.json](hardening-checks.json) |
| 新IME／重试／CRLF／缩放／无JS | 45项 | [browser/checks.json](browser/checks.json) |
| 根路径字体请求／像素／fallback | 74项 | [font-browser/root/checks.json](font-browser/root/checks.json) |
| Pages独立构建功能 | 84项 | [pages-base.json](pages-base.json) |
| Pages字体专项 | 74项 | [font-browser/pages/checks.json](font-browser/pages/checks.json) |

合计1,138项浏览器断言，两个host的重复边界分别计数；不是1,138种实机。Node和Python计数独立，汇总见[verification-summary.json](verification-summary.json)。故障、输入法和CSP攻击仅由隔离fixture合成；未发布合成账号或攻击代码。

## 发现与来源

- [安全初审](security-review.json)、[CSP修复复核](security-buildguard.json)、[当前依赖公告](security-dependencies.json)：70个精确版本0查询错误／0命中，不是完整npm audit或未知漏洞保证。
- [有限凭证模式扫描](credential-patterns.json)：2,090份可达历史blob及扫描时当前文件无匹配；不涵盖全部秘密格式，不输出秘密值。
- [生命周期复现](runtime-review.json)、[原重试回归失败](retry-baseline-node.log)、[IME原构建证明](ime-baseline.json)、[独立对抗复核](adversarial-review.json)：明确实际模块模拟、合成浏览器和未验证物理IME的区别。
- [结构审查](structure-review.json)、[当前仓库检查](repository-structure.json)：显式退出、参考式链接、代码排除、缓存边界与七个冻结例外；不宣称CommonMark完整解析或外链检查。
- [来源／产物](source-integrity.json)：58份指定原始素材、像素／时钟／天气算法及完整字体与基线一致，99份public与dist字节一致。生命周期／UI／构建基础设施有明确修改。
- [字体作者证明](font-subset.json)及[完整检查](font-check.log)：566映射、567输出字形，原轮廓和度量一致、独立生成字节一致；保留完整字体和许可证。两个host各20组Canvas像素／metrics比较一致；完整字形范围由作者工具比对，浏览器采样不冒充全部实机。
- [FontFaceSet诊断](font-browser/fontfaceset-diagnostic.json)：重叠未加载fallback可使check返回false；未强制下载完整字体来满足旧断言。
- [资源／像素完整性](assets-verify.log)、[既有衍生检查](assets-check.log)、[装饰像素检查](pixel-check.log)。

## 性能证据

[资源对照](resource-comparison.json)由[原始首屏请求](resources-before.json)和[新首屏请求](resources-after.json)计算：同1440×1100／DPR1条件资源body合计12,295,753→8,567,795bytes（30.32%减少）。初始图像从六张变为三张，全部滚动后图像总量不变。[小视口](resources-small-viewport.json)为单独的390×844／DPR2合成观察，无改动前对照，不计算降幅。

[单次原版](performance-before.json)、[单次新版](performance-after.json)、[DPR4](performance-after-dpr4.json)全部保留；单次启动有波动，因此预先固定三轮配对和交替顺序，再采集[全部配对数据](performance-paired.json)。每轮新Chromium，2秒稳定＋12秒采样，无截图、并行浏览器、编码或网络限速。原版基线由固定提交隔离导出，原JS／CSS名称和SHA验证。没有择优删样。

配对高清就绪中位数881.8→691.7ms，范围分别735.8–1032与648.1–717.7ms；预览中位516.7→456.7ms。这里只陈述本地三个样本，不保证访客启动或物理显示FPS。rAF及来源换帧的全部原值、软件条件与未验证范围保留在JSON。

本目录验证本地生产产物。CI、Pages和Sites实际保存／发布会由提交后的平台状态分别确认；当前受限环境未独立验证完整npm audit、生产响应头、外网浏览、物理IME和真实设备CWV／内存。
