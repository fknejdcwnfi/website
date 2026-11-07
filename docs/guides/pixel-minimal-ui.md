# 全站像素字体与简约中性界面

2026-11-07：用户进一步要求所有文字和样式体现像素风格，UI借鉴Claude的简洁，同时保留已有核心人物与自动GitHub／Sites更新。本指南取代[上一版](pixel-world-ui.md)的华丽外观要求；原指南、资产与证据保留历史。

## 外观与内容

采用暖中性底色、深色文字、少量强调色、细边框、方角及充足留白。桌面以左导航和受控宽度正文为主，隐藏重复顶栏菜单和右侧目录；窄屏切换为顶栏章节导航。借鉴的是简洁的层级与布局，网站继续使用自己的身份、资料和功能，不复制其他产品品牌或加入聊天界面。

默认页面取消暮色外景、木牌、草边、草方块、灯笼、装饰卡图及人物figure上的金色圆环与光晕。保留历史装饰资源，活动CSS及DOM不能因残留规则仍请求它们。人物原画内的樱花、富士山与夕阳属于原场景，保持不变。

仍保留首页、关于、作品、兴趣、游戏、社交六章节及实际导航／搜索目标。名称fknejdcwnfi、HELLOWORLD、现有邮箱／GitHub、真实项目与简体中文内容不变；账号、玩家资料和媒体未提供时继续留空。[内容模块指南](profile-modules.md)中的安全链接、纯文本、复制反馈、原生details和可组合内容规则继续适用。

## 真实像素文字

使用本地托管Fusion Pixel中英像素字体，保留分发文件与授权。正文、标题、链接、导航、输入框、按钮、键盘提示、说明、图注、状态与无JS文字都使用同一字体栈；不能仅把英文标签换成像素字而让中文落回普通系统字体。

字号按字体原生像素网格选取，注意窄屏可读性和换行；避免通过滤镜、图片化文字、负字距或模拟粗体制造像素效果。图标使用可访问的SVG像素路径，不让系统彩色emoji混入界面标题和导航。用户实际填写的兴趣说明、账号或自定义文字仍是纯文本，不为了图标检查擅自删改。

字体及主题由文档CSS加载，初始HTML和无JS也有相同排版。检查时同时确认已注册且实际加载的FontFace、中英字符可用以及各类节点计算后的font-family；单独的`document.fonts.check`或CSS声明不能证明指定字体真的存在。

本轮字体为Fusion Pixel 12px proportional简体中文版本，CSS别名为`Fusion Pixel`。完整来源、上游固定提交、版本和SHA记录在[字体来源](../../public/fonts/FusionPixel-SOURCE.txt)，许可证见[Fusion Pixel OFL](../../public/fonts/FusionPixel-OFL.txt)，并保留[Ark Pixel](../../public/fonts/FusionPixel-ArkPixel-OFL.txt)与[Cubic11](../../public/fonts/FusionPixel-Cubic11-OFL.txt)的上游声明。OTF重新封装为本地WOFF2后，解压的字符映射和CFF字形轮廓逐位元组相同，未修改字形；字体含38130个Unicode字符。字体准备时已核对当前源文件的388/388个不同中日韩汉字及拉丁字母／数字。新增罕见用户文字仍需另查覆盖，不能保证任意Unicode都有该字体字形。

## 人物与实现边界

保留一个稳定的ReferenceScene实例、原生像素、固定96色、16个80ms来源锚点、1.28秒循环、48个估计过渡及50fps采样。一次有界原生图集读回、两帧重建缓存、4／6／8倍尺寸政策、低内存上限及最高2864×2136画布继续由现有实现负责。

448片雪与60片花瓣保持独立48／96秒时钟；入口40雪／12樱、同parser群组和video节点、实际影片相位接手及180ms气象交接不变。圆形viewport和外层figure都不增加边框或光环。保持减少动态的可逆选择、隐藏／离屏暂停、resize相位及故障恢复，不通过重挂载或新关键帧改变角色运动。

`assets/source/**`、`docs/reference/**`及`reference-projects/fuji-wind/`中的原工程仍不可变。旧主题、旧功能和历史证据不因新UI而删除。

布局／字体样式属于profile主题及文档CSS；shell、像素SVG、标题和项目标记在React组件与`staticMarkup.ts`中对应，内容继续由同一site/selectors生成。保留所有章节、卡片和搜索目标ID。活动导航仍通过最多一个待执行rAF更新shell状态，不用章节状态作场景key或条件卸载。

短章节在文档底部可能无法滚动到通常的高亮判定线。显式点击章节后暂时保留该目标；访客真正滚到其他位置时释放，再按可见章节计算。相同hash再次点击也能重新导航；搜索Enter通过`site:navigate`告知同一导航逻辑。不能仅固定按URL hash显示高亮，否则手动滚回首页仍会错误显示底部章节。本轮QA覆盖点击游戏、保持hash手动滚回顶部、再点同一游戏hash及回到首页，并检查Canvas／video始终是同一节点。

## 构建与本轮验证

使用Node24与现有依赖。默认生产构建用于GitHub Pages的`/website/`，Sites使用根路径；保留Vite路径处理及既有Site身份：

```bash
npm run build
# Pages预览：http://127.0.0.1:5180/website/
VITE_BASE=/ npm run build
# Sites预览：http://127.0.0.1:5180/
npm run preview -- --host 127.0.0.1 --port 5180
```

以下为应执行范围，结果仅在实际运行后记录：

```bash
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_pixel_minimal_ui.py --url http://127.0.0.1:5180/
python3 scripts/qa/verify_profile_modules.py --url http://127.0.0.1:5180/ --output work/pixel-minimal-ui/profile
python3 scripts/qa/verify_final_scene.py --url http://127.0.0.1:5180/ --output work/pixel-minimal-ui/scene
```

新UI报告默认写入`artifacts/pixel-minimal-ui/`，也可用`--output`选择独立目录。检查桌面与320／390／768／1100／1200／1440／1672px：活动导航、同一Canvas／video节点、字体、无旧装饰请求、表格不被裁切、卡片与导航无溢出、搜索快捷键与焦点、减少动态控制、无JS完整内容和本地资源。

模块QA的合成账号、媒体和游戏数据只在独立夹具中使用，不进入正式内容或dist。保留既有来源像素、时钟、雪樱、首绘入口、相位、失败与resize检查；只在旧测试绑定已取消菜单或装饰时修改相应布局断言，不能删除功能或画质检查以求通过。

GitHub保持现有PR、CI、main合并和Actions／Pages流程，不修改工作流或绕过检查，不运行手动强推部署命令。Sites通过官方工具保存和发布同一已推送源码对应的产物，保留project_id与受众。字体、构建、浏览器验证、GitHub合并与Sites发布各自记录实际状态；前轮成功不代表本轮已经完成。
