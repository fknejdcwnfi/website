# 奶油色风景页面与双侧栏导航

2026-11-07：用户最新提供四页参考拼图，要求已有网站采用暮色背景、奶油色页面与配图卡片，同时保留核心人物。本指南取代[简约界面指南](pixel-minimal-ui.md)中的无景观、单侧栏与方角外观；原指南、主题和证据保留历史。

## 当前外观

- 页面周围采用已有暮色像素背景，页首和章节导航为蓝色。
- 桌面左右导航均为圆角奶油面板，活动入口使用暖桃色；主内容的关于、作品等阅读区域使用奶油色面板。
- 兴趣图鉴使用《火影忍者》《名侦探柯南》配图，游戏区域使用既有游戏景观，GitHub和邮箱使用已有配图卡片。
- 平板／手机收起侧栏，保留全部六个header章节入口及可展开的原生目录。表格、卡片和右栏不能靠页面隐藏溢出来掩盖裁切。

圆角是最新参考中的明确外观，覆盖旧方形面板要求。之前的全站像素字体要求未被撤销：中英文字、按钮、输入、键盘提示、状态、图注和无JS内容继续使用本地Fusion Pixel；界面图标继续使用像素SVG。字体来源及授权见[来源记录](../../public/fonts/FusionPixel-SOURCE.txt)和[OFL](../../public/fonts/FusionPixel-OFL.txt)。

名称fknejdcwnfi、HELLOWORLD、真实项目、邮箱／GitHub、简体中文、兴趣和王者荣耀区域保持。用户未提供的账号、玩家详情、成绩和媒体继续留空。装饰图不应被描述成用户的真实游戏截图或个人经历；[内容模块指南](profile-modules.md)中的可配置行为继续适用。

## 资源与实现边界

复用`public/assets/pixel-ui/`中的`twilight-world.png`、`naruto.png`、`conan.png`、`game-realm.png`、`social-github.png`和`social-mail.png`。这些是页面装饰，不能用于替换人物、重建头发或改写原场景。旧木牌、像素边框等独有资源保留历史，是否进入本轮页面由最新参考决定。

`creamScenic.css`经`src/app/styles/app.css`导入，CSS和字体在React前及无JS时可用。现有interest/game的scene容器和social-card平台标记供CSS选择背景；React与`staticMarkup.ts`继续生成相同内容、章节／卡片ID及可访问图标。

核心ReferenceScene保持同一实例。原生来源、固定96色、16个80ms锚点、1.28秒周期、48个估计过渡、50fps采样、一次图集读回、两帧缓存、自适应4／6／8倍输出、低内存上限及最高2864×2136均沿用已有实现。448雪／60花瓣的独立时钟、parser入口、同video节点与真实相位接手、减少动态、隐藏／离屏暂停和失败重试不因UI而重做。

实际`.reference-scene__viewport`仍为无边框、无阴影的圆形，保留原裁切。`assets/source/**`、`docs/reference/**`和`reference-projects/fuji-wind/`原文件继续不可变；历史功能、源资料和证据不删除。

最新参考中的装饰圆环由外层figure伪元素绘制，和页面背景一样属于独立外观，不是实际viewport的边框，也不进入Canvas像素。前版简约主题取消外景／圆环的规则已是历史。

## 导航与响应式

页首、左导航和右目录使用同一六章节派生数据及活动状态。显式点击后保留所选目标，以处理短章节在文档底部被浏览器夹取的情况；真正滚到其他位置时释放，再按当前位置判定。相同hash再次点击仍可导航，搜索Enter通过`site:navigate`通知同一逻辑。活动状态只更新shell，不以章节作为场景key，不重挂载Canvas／video。

在320／390／768／1100／1200／1440／1672px检查顶部六入口、正文、项目表格、卡片及可见左右栏的真实边界和内部宽度。短桌面窗口还需确保侧栏末项可滚动到视野中。阅读文字、蓝色header、奶油卡片及桃色活动状态分别核对对比度与焦点。

## 本轮检查与发布

以下列出检查范围，实际结果只在执行后记录；不能将此前简约或华丽主题的通过结果当作本轮证据。

```bash
npm run build
npm run assets:check
npm run assets:verify
# Sites根路径产物；默认构建仍供Pages的/website/使用。
VITE_BASE=/ npm run build
npm run preview -- --host 127.0.0.1 --port 5180
python3 scripts/qa/verify_cream_scenic_ui.py --url http://127.0.0.1:5180/
python3 scripts/qa/verify_profile_modules.py --url http://127.0.0.1:5180/ --output work/cream-scenic-ui/profile
python3 scripts/qa/verify_final_scene.py --url http://127.0.0.1:5180/ --output work/cream-scenic-ui/scene
```

新UI报告默认位于`artifacts/cream-scenic-ui/`，可用`--output`指定其他独立目录。检查内容包括：已注册并实际加载的Fusion Pixel、中英字体与状态文案、暮色和五张卡图解码、圆角奶油面板、蓝色页首／桃色活动入口、三处导航同步、相同hash和手动滚动、Canvas／video身份、多宽度及右栏无溢出、键盘搜索、减少动态和无JS内容。

旧profile QA只改变一项外观断言：`pixel_square_cards`的零半径改为`reference_rounded_cards`的正半径，符合最新用户参考。其他功能、无JS、账号留空、复制反馈和合成夹具检查保持；夹具不能进入正式dist，旧artifact不覆盖。原始像素、来源时钟、雪樱及相位等核心检查继续执行。

使用默认Vite基础路径构建Pages的`/website/`，以`VITE_BASE=/`构建Sites根路径。按现有PR／CI／main合并与Actions流程同步GitHub，不修改工作流或绕过检查；通过Sites官方工具保存和发布与已推送源码匹配的产物，沿用project_id及受众。构建、浏览器、GitHub和Sites分别记录真实状态，不预先宣告成功。
