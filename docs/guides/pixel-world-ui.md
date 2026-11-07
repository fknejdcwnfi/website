# 参考图驱动的暮色像素世界界面

2026-11-07：用户要求紧贴四张参考截图更新已有网站UI，同时保留核心人物效果，并在完成检查后同步GitHub、按既有流程合并及更新Sites。本轮改变页面外观与装饰，不重建人物或替换已有个人内容。

## 当前视觉契约

页面采用暮色像素景观、半透明蓝紫面板、金色／紫色像素边框、木牌章节标题、草方块、灯笼和统一的导航图标。保留页首搜索、章节导航、作品、兴趣、游戏、社交与页尾；移动端内容继续可读、可导航，不能为了截图排版裁掉正文或藏住项目表格。

页面文案仍为简体中文，保留fknejdcwnfi、HELLOWORLD、已有邮箱、GitHub及真实项目。动漫兴趣、王者荣耀区域和可配置内容以[模块指南](profile-modules.md)为准。参考图中的未知账号、游戏资料、成绩与媒体不能直接当作用户的真实资料填入。

较早的白底文档配色和布局属于历史设计记录。当前人物来源与动态规则继续由[场景指南](poetic-pixel.md)约束；本指南只替换周围的网站UI外观。

## 页面装饰与人物的边界

`public/assets/pixel-ui/`存放新增的暮色背景、兴趣／游戏／社交装饰图及草方块、草边、灯笼、木牌、像素边框SVG。这些图是页面装饰，不是角色原始资料，不应用来重新生成人物脸、头发、姿势或场景动作。

金色圆形外沿由`.hero__visual::before`绘制在外层figure。真正的`.reference-scene__viewport`仍保持圆形、无边框、无阴影；原有cover裁切与画布像素不变。装饰层不拦截指针，不进入Canvas像素、源图集或媒体相位计算。

以下约束保持：

- 原生358×267来源、固定96色、16个80ms动作锚点与1.28秒来源周期。
- 48个估计过渡、64×20ms播放采样；50fps采样不代表新增原始资料或实测物理屏幕帧率。
- 两次来源颜色Scale2x、一次有界原生图集读回、两帧缓存、自适应4／6／8倍输出和低内存上限。
- 448片雪、60片花瓣及其独立48／96秒时钟；保留表情区减量。
- 同一parser入口群组／video节点、真实影片相位接手、仅气象层180ms交接。
- 减少动态的本机可逆选择、隐藏／离屏暂停、保留相位的resize、有限重试及失败后的完整内容和预览。

`assets/source/**`、`docs/reference/**`和`reference-projects/fuji-wind/`中的原ZIP／原文件仍不可变。旧功能、指南和验证证据保留历史，不为简化本轮UI而删除。

## 实现入口与静态页面一致性

| 文件 | 本轮职责 |
| --- | --- |
| `src/features/profile/styles/pixelWorld.css` | 页面主题、背景、像素边框、木牌、装饰及响应式覆盖 |
| `src/app/styles/app.css` | 按文档依赖导入主题，在JS运行前和无JS时提供相同样式 |
| `src/features/profile/components/SiteShell.tsx` | 页首、搜索、侧导航、目录、页尾和滚动活动章节 |
| `src/features/profile/content/navigationIcons.ts` | React与静态HTML共用的导航像素路径 |
| `src/app/App.tsx` | hero文案、强调文字与唯一场景实例的位置 |
| `src/features/profile/components/PersonalSections.tsx` | 介绍、作品表格与装饰性项目缩略图 |
| `src/features/profile/components/ProfileModules.tsx` | 兴趣／游戏的装饰背景及已有可配置卡片行为 |
| `src/features/profile/content/staticMarkup.ts` | 与React对应的初始shell、锚点、图标、缩略图和背景容器 |

内容继续取自同一`site.ts`和selectors；静态HTML必须转义用户文字、保持相同章节及卡片ID。无JS时保留原生details、真实链接及账号文字；搜索、复制反馈和滚动高亮属于渐进增强，不添加无效静态控件。

活动导航通过scroll／resize／hashchange监听更新，每次最多排一个requestAnimationFrame，并在卸载时移除监听和取消待执行任务。活动章节只改变shell状态及链接的`aria-current="location"`，不能给场景新增随章节变化的key、条件卸载或替换renderer。这样导航高亮不会重新加载图集或重置来源相位。

深色面板与浅色内容卡分别检查文字、链接和焦点对比度；浅卡不能直接继承适合深背景的浅色链接或金色焦点。窄屏表格需检查实际内容宽度，不能仅依赖页面`overflow-x:hidden`掩盖裁切。

## 两个发布基础路径

使用Node24及现有依赖。默认Vite生产基础路径保留GitHub Pages的`/website/`：

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 5180
# 预览 http://127.0.0.1:5180/website/
```

同一份源代码用于Sites根路径时：

```bash
VITE_BASE=/ npm run build
npm run preview -- --host 127.0.0.1 --port 5180
# 预览 http://127.0.0.1:5180/
```

CSS中的本地资源URL由Vite构建处理；JS与静态标记的图片路径使用对应的BASE_URL／base参数。不要通过全局改写默认base破坏Pages部署。发布Sites时沿用`.openai/hosting.json`中的既有project_id及`dist`静态目录；打包的dist必须来自将要保存的同一份已推送源码。

GitHub继续使用现有PR／CI／main合并与Actions发布流程，不修改workflows、不绕过检查，也不运行会强推手动gh-pages分支的`npm run deploy`。Sites使用官方保存／部署流程并保留原Site身份和受众。

## 本轮验证范围与结果记录

以下是本轮应执行的检查范围，不是预先宣布的通过结果。新结果应与旧`artifacts/scenic-refinement/`和`artifacts/profile-modules/`证据区分，记录本次版本、基础路径与实际浏览器条件。

```bash
npm run build
npm run assets:check
npm run assets:verify
# 对选定的实际预览路径运行；--output指定本轮独立目录。
python3 scripts/qa/verify_profile_modules.py --url http://127.0.0.1:5180/ --output work/pixel-world-ui/profile
python3 scripts/qa/verify_final_scene.py --url http://127.0.0.1:5180/ --output work/pixel-world-ui/scene
```

`verify_profile_modules.py`会另建隔离的合成夹具，默认夹具网址仍为`http://127.0.0.1:5181/website/`。夹具不替换正式内容或dist，不能打包发布。若平台预览工具有额外约束，按其官方流程执行，不临时安装或绕过平台浏览器能力。

需要重点核对：

- 与四张参考图的背景、面板、边框、标题、图标、间距及整体层级；桌面和320／390／768px布局。
- 所有图片／CSS／字体加载，Pages子路径与Sites根路径的URL正确。
- 三处导航高亮、搜索跳转／焦点、键盘操作、浅卡链接与焦点、项目表格内容不被裁切。
- React、无JS与模块加载失败时的内容和外观对应，真实链接／账号留空及可配置模块行为保留。
- 原始像素／来源锚点、雪樱、入口无媒体运动、同节点相位接手、减少动态、离屏暂停、故障重试与resize相位保持。

旧场景QA包含基于534px桌面圆形的固定输出尺寸断言；本轮figure尺寸随新布局变化，应按实际圆形CSS直径×DPR及既有resolution策略核对档位。不能为使旧布局断言通过而改写renderer或降低像素／相位检查。构建、浏览器、GitHub及Sites状态分别记录，未完成的验证或发布不能写成成功。
