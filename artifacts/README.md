# 验证证据索引

各目录记录它们生成时的源码、构建、基础路径和运行条件，不能自动视为当前提交已重新通过。当前网站是奶油色风景UI、真实个人模块和`poeticPixel`圆形场景；旧图像或检查数量不替代新一轮验证。新一轮先写独立输出目录，审查后再登记；不覆盖唯一的历史证据。

## 当前实现的已有证据

| 目录 | 实际记录的范围 |
| --- | --- |
| [audit-20261113](audit-20261113/README.md) | 最新复审：CSP／重试／IME、lazy图片、忠实字体子集、结构CLI、独立及配对资源／时序采样 |
| [security-audit](security-audit/README.md) | 2026-11-08安全／健壮性／性能与结构审计；固定依赖公告查询、故障与CSP探针、无损体积比较、独立性能采样与本轮回归 |
| [ui-consistency](ui-consistency/README.md) | 最近一轮边框、搜索、真实作品、奶油色UI、个人模块与场景回归；含Pages子路径检查，具体结果以该轮README与JSON为准 |
| [scenic-refinement](scenic-refinement/README.md) | 当前96色圆形场景的来源、锚点、雪樱、入口、重建与独立性能观察；早于后续页面UI修改 |
| [profile-modules](profile-modules/README.md) | 个人模块及隔离合成配置的基础验收；其中旧外观截图不代表最新奶油色页面 |

同一轮本地验证、GitHub构建、Pages部署与官方Sites保存／发布是不同结果；没有实际证据时不将其中一项写成其他项已成功。日期、提交和检查数量应从具体报告读取。

## 历史证据

| 阶段 | 保留目录 |
| --- | --- |
| 前版UI及整站截图 | [cream-scenic-ui](cream-scenic-ui/README.md)（同主题较早一轮）、[pixel-minimal-ui](pixel-minimal-ui/README.md)、[pixel-world-ui](pixel-world-ui/README.md)、[personal-site](personal-site/README.md) |
| 前版场景和逐帧展示 | [final-scene](final-scene/)、[poetic-pixel](poetic-pixel/)、[scenic-snow](scenic-snow/README.md)、[faithful-pixel](faithful-pixel/)、[reference-scene](reference-scene/)、[calm-circle](calm-circle/README.md) |
| 旧近景、发束和重建 | [reference-rebuild](reference-rebuild/README.md)、[video-layered](video-layered/README.md)、[reliable-motion](reliable-motion/)、[natural-wind](natural-wind/)、[crisp-circle](crisp-circle/)、[flowing-hair](flowing-hair/README.md)、[air-breeze](air-breeze/)、[gentle-portrait](gentle-portrait/README.md)、[pixel-world](pixel-world/README.md) |
| 更早迁出的证据 | [archive](../archive/README.md)内的v2／v4／v5影像、原始JSON与旧runtime |

## 保存与发布边界

`artifacts/`、仓库`archive/`、`docs/`及原工程不属于Vite的`public/`，不会仅因存在于仓库而复制到`dist/`。当前`public/`仍包含一些历史衍生资源，它们随构建复制并可被对应URL访问；这与证据目录、首页实际请求及逐帧下载是不同范围，详见[仓库维护](../docs/guides/repository-maintenance.md)。

受控时间截图、GIF或MP4编码率不能证明实物显示器FPS。性能测量需注明实际浏览器、视口／DPR、采样时长与是否存在并行浏览器工作。历史数值不改写为新版本结果。
