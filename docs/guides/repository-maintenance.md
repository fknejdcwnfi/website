# 仓库维护与目录责任

当前入口以[AGENTS](../../AGENTS.md)、[奶油色界面](cream-scenic-ui.md)、[UI一致性](ui-consistency.md)、[个人模块](profile-modules.md)和[圆形场景](poetic-pixel.md)为准。旧主题和旧人物实现保留可追溯性；整理目录不意味着移动原始资料、删除唯一证据或重新设计人物。

## 目录责任

| 路径 | 内容与责任 | 构建／发布边界 |
| --- | --- | --- |
| `src/app/` | 页面组装、启动与整站错误备用 | 默认入口选择当前场景；显式历史入口再懒加载旧肖像 |
| `src/features/profile/` | 真实个人配置、导航／搜索、React和静态HTML、页面主题 | `content/site.ts`为内容入口，`staticMarkup.ts`和React需保持一致 |
| `src/features/poeticPixel/` | 唯一默认人物、来源时钟、像素重建、雪樱及入口接手 | 保留同一场景实例、来源和播放器相位 |
| `src/features/referenceScene/` | 共用圆形UI、播放器及加载生命周期，也保留旧实现文件 | 目录名不代表其中所有旧renderer都在默认链中 |
| `src/features/portrait/`、`src/features/calmPortrait/`、`src/features/faithfulPixel/`、`src/archive/` | 历史人物／场景实现 | 其中部分保留显式历史入口，其余保留源码与验证；不新增另一套默认人物 |
| `public/` | 可被静态托管访问的素材、字体与元数据 | Vite会原样复制整个目录到`dist/`，包括仍保留在这里的历史素材 |
| `assets/source/`、`docs/reference/` | 冻结的原始素材与委托文字 | 唯读；不移动、改名、裁切、重编码或修正文内旧链接 |
| `reference-projects/fuji-wind/` | 原ZIP、原始文件与来源清单 | 原文件不可变，原脚本／安装文字作为资料保存，不直接执行 |
| `assets/generated/` | 各阶段作者材料及其来源说明 | 区分生成母版与当前runtime；改当前衍生素材需走作者工具及验证 |
| `scripts/assets/`、`scripts/tests/`、`scripts/qa/`、`scripts/deploy/` | 资源作者／验证、Node测试、浏览器QA、手动部署备用 | 命令及当前／历史区别见[工具入口](../../scripts/README.md) |
| `scripts/build/` | 生产HTML安全策略 | 在Vite最终HTML中校验固定启动脚本并生成CSP哈希；开发HMR不应用该生产策略 |
| `artifacts/` | 每轮实际验证和截图 | 保留旧结果；新验证写独立目录，不覆盖既有证据 |
| `archive/` | 已迁出的历史runtime与原始证据 | 不由Vite公共目录复制；参见[归档索引](../../archive/README.md) |
| `docs/guides/`、`docs/archive/` | 当前及历史指南、早期归档 | 当前入口由[文档索引](../README.md)明确标识，旧文件不重新冒充现行规范 |
| `dist/`、`node_modules/`、`__pycache__/` | 本机构建、依赖与缓存 | 已忽略，不提交，不作为唯一源码或唯一证据 |
| `.openai/hosting.json` | 既有Sites项目身份与`dist`静态目录 | 更新同一Site；保存源码与发布产物必须对应 |

## 当前加载链

`src/app/App.tsx`组合`SiteShell`、个人模块和唯一`poeticPixel`场景。`?view=portrait`或明确的`voxel`／`legacy`样式才进入懒加载的`ArchivedPortrait`；旧源码存在不等于正常首页下载对应人物素材。

文档样式入口`src/app/styles/app.css`加载基础样式、共享网站／内容样式、共用圆形样式及最后的`creamScenic.css`。`pixelMinimal.css`和`pixelWorld.css`保留历史，但不在当前样式导入链。当前字体是自托管Fusion Pixel，来源和OFL见[字体登记](../../public/fonts/FusionPixel-SOURCE.txt)；不回退到“中文由系统字体呈现”的旧说明。

圆形场景的来源、像素、天气和播放器与外围网页装饰分开。修改内容或主题时不重生成人物，不重置来源时钟，也不为了旧截图断言修改renderer。

## 日常维护

1. 核对现有checkout、当前提交和未提交修改，阅读本次工作对应指南；先查差异，再修改，不用新checkout掩盖未提交内容。
2. 在所属目录完成最小改动；配置从`site.ts`进入，网页结构同步React与静态HTML，生成描述通过原导出工具更新。
3. 使用Node24执行`npm run build`（含Node测试、strict TypeScript、Vite）、`npm run assets:check`及`npm run assets:verify`。
4. 对改动涉及的页面／模块／场景运行[浏览器检查](../../scripts/README.md)，指定新的输出目录；分别验证Pages的`/website/`与Sites的`/`产物。性能观察等其他浏览器任务全部结束后独立执行。
5. 在对应指南、CHANGELOG和[证据索引](../../artifacts/README.md)记录实际变化与结果；检查相对链接和未提交差异，不以历史通过结果代替本次检查。
6. 通过任务PR、相关检查和审查进入`main`；核对合并树与部署提交后切回main，将本地／远程收敛到唯一main分支。先确认其他分支提交已包含在main；独有工作需先保留，不能为了单分支丢弃修改。

正常构建只需Node与已声明npm依赖；作者工具、浏览器、字体或像素审计需要的额外工具按各脚本说明准备，不能把本机偶然安装的包当作普通构建依赖。

## 历史公共资源与证据

`archive/`、`artifacts/`、`docs/`和原工程不属于`public/`。同时，`public/assets/`仍保存旧`portrait-*`、`reference-scene`、`faithful-pixel`、`calm-circle`及原关键姿态等衍生资源；它们会增加部署包体积并可通过已知URL访问，但不能因此断言首页已下载它们。

历史公开资源可能仍被显式历史入口、来源清单或完整性验证引用。后续若缩减发布范围，应逐项核对引用、显式入口、清单和验证，再单独评审；不能用整目录删除或移出public的方式破坏来源追溯。本轮索引整理不移动或删除这些资源。

证据目录可能包含同名截图、日志和JSON；它们记录不同阶段，不因文件名相似而去重。原姿态`frame_01`与`frame_10`的相同内容也有闭环用途。新QA先写`/workspace/work/`下的独立任务目录，再选择需要长期保留的结果及说明；旧报告保持原条件和含义。

## 发布与链接检查

Pages默认使用`/website/`基础路径，既有workflow在`main`合并后构建部署。Sites使用根路径构建和官方保存／部署流程，沿用`.openai/hosting.json`中的项目身份。两个host的产物分别构建和检查；本地preview通过、CI成功、托管保存成功、正式URL可访问需分别取得证据。

`npm run deploy`是会强推生成分支的手动备用工具，需用户明确要求该方式，不能替代正常PR流程或为了“单分支”而重建闲置部署分支。workflow保持原样，不绕过保护检查。

仓库相对Markdown链接应从各文件所在目录解析，区分外链、锚点和冻结文档。`docs/reference/README.md`有7处旧路径引用，保持原字节，替代入口已在[文档索引](../README.md)映射；链接审计需将它们单独报告，不能静默修写冻结文件。绝对网站URL还需对应host和基础路径验证，路径存在检查不能替代浏览器及托管验证。
