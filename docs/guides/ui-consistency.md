# 统一边框、搜索与真实作品信息

2026-11-07：用户要求补充作品内容、统一各处UI边框，并指出搜索输入获得焦点时出现难看的内层矩形和过大的松散结果区。本轮在[奶油色风景页面](cream-scenic-ui.md)上修整，不重新设计页面或人物。

## 一套边框和焦点

在当前`creamScenic.css`中集中使用边框与圆角tokens：阅读面板、侧栏和搜索结果面板使用16px圆角；内容卡片与项目表格外层使用14px圆角；导航、搜索输入容器和可操作控件使用10px圆角；普通边框厚度为1px。实际圆形场景、外层装饰圆环、圆形图标和小型非交互标签各有原本用途，不强行改成矩形控件。

搜索输入本身保持无边框、无outline，焦点显示在同一个圆角form容器上。键盘用户仍能清楚辨认焦点；其他链接、按钮和原生summary保留可见焦点。不要通过全局隐藏outline修复搜索，也不要增加第二层方形焦点或只靠颜色微变表达状态。

桌面与手机必须使用同一规则。检查实际computed style和焦点状态，同时核对可见边界；不能只在CSS中声明变量而未应用，也不能靠隐藏页面横向溢出来掩盖内容裁切。

## 紧凑的本地搜索

搜索仍只索引现有本站内容，无需服务端或外部搜索请求。保留可访问名称“搜索此网站”、slash快捷键、Escape关闭、真实锚点与点击后的目标焦点。结果按站内章节归组，使用本地SVG像素图标，标题／摘要层级清楚；整体高度受视口约束，并在结果区内部滚动。

通过真实键盘操作检查ArrowDown／ArrowUp的结果移动、Enter的选中目标和Escape返回输入。结果链接仍可用Tab和指针访问；使用链接语义时不要仅为了样式强行套用不完整的listbox／combobox角色。选择结果通过同一`site:navigate`／显式锚点机制更新导航，短章节和相同hash仍可重新定位。

## 作品内容与静态一致性

补充已有Living Portrait和Xiangqi Review的真实定位、实现内容与项目资料，不添加未经提供的项目、用户经历、成绩或账号。保留`project-living-portrait`、`project-xiangqi-review`、项目表格语义和每行唯一主项目链接；外部链接使用HTTPS及安全的新标签页属性。

Xiangqi资料以公开仓库固定版本[2381c67](https://github.com/fknejdcwnfi/xiangqi-review/tree/2381c673053679e9963842fe39794f105c7509a7)为依据：`pom.xml`的Java 8／Maven、Swing棋盘绘制与点击选择移动、兵卒过河基础规则。将帅规则仍有未完成项，因此页面明确称为“开发原型”并保留待补全说明，不把仓库名称推断成已完成的复盘、AI或完整象棋产品。概览数字由当前有效项目派生，不能写成虚构的项目总量。

详情使用原生`details/summary`，不依赖JavaScript才能阅读。内容配置、类型与selector是数据入口；React和`staticMarkup.ts`生成相同信息与可展开区域。新增实际能力文字也应进入本地搜索索引，搜索结果仍指向原项目行。无JS时不存在无法使用的搜索控件，而作品详情、正文、目录和全部六章节入口仍可访问。

## 人物与资源边界

本轮只改页面内容、shell和样式。原始像素、16个80ms锚点、1.28秒来源周期、50fps估计过渡、自适应高清重建、448雪／60花瓣、媒体接手、减少动态和离屏暂停继续原实现；搜索、展开详情和导航不得替换Canvas／video节点。实际viewport保持无边框、无阴影圆形，页面装饰圆环仍在外层figure。

继续使用自托管Fusion Pixel和SVG图标，保留字体来源／OFL及本地配图。`assets/source/**`、`docs/reference/**`和`reference-projects/fuji-wind/`原文件不可变。主题经文档CSS导入，保持首屏与无JS外观以及Pages和Sites两个基础路径。

## 验证与发布

以下是本轮验证范围，执行前不宣称通过；旧主题和场景证据只代表当时版本。

```bash
npm run build
npm run assets:check
npm run assets:verify
# 默认构建用于Pages的/website/，Sites使用根路径：
VITE_BASE=/ npm run build
npm run preview -- --host 127.0.0.1 --port 5180
python3 scripts/qa/verify_ui_consistency.py --url http://127.0.0.1:5180/
python3 scripts/qa/verify_cream_scenic_ui.py --url http://127.0.0.1:5180/ --output work/ui-consistency/cream
python3 scripts/qa/verify_profile_modules.py --url http://127.0.0.1:5180/ --output work/ui-consistency/profile
python3 scripts/qa/verify_final_scene.py --url http://127.0.0.1:5180/ --output work/ui-consistency/scene
```

新脚本默认独立保存到`artifacts/ui-consistency/`，支持`--output`。覆盖桌面／手机单层搜索焦点、紧凑分组图标与内部滚动、真实键盘选择、1px边框及16／14／10px圆角、多宽度溢出、两项真实作品和原生展开、搜索后的同一人物节点，以及静态／React详情一致。既有cream、profile和scene检查继续覆盖图片／字体、可配置内容、减少动态、资源失败及来源像素等边界。

通过现有PR、CI、main合并和Actions流程同步GitHub；保留工作流与分支保护。Sites沿用已有project_id及受众，保存／发布与已推送源码匹配的产物。分别核实GitHub、预览和正式网址的实际结果，不把构建成功或创建预览当作已正式发布。
