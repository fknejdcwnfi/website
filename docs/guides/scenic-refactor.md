# 仓库整理与像素微动

本轮保留奶油色Minecraft风景、人物原画、圆形裁切、来源动作和雪樱。新增的灯笼／晶体微动、章节标题入场、卡片反馈属于页面层，与人物renderer分开；不动画大背景、滤镜或人物外框。

## 当前职责

- `SiteShell`组合骨架；`SiteSearch`、`NavigationIcon`和`useActiveSection`负责搜索、图标与显式导航意图，保留同一人物节点。
- `usePageMotion`同步本地暂停、系统减少动态与页面可见性。外围初始静止，无JS仍可阅读；开启后最多3处小型常驻装饰。标题默认可见，只进入一次，不等待Observer才显示正文。
- 人物仍默认动态。暂停按钮通过同页事件同时通知外围装饰，存储不可用时本页选择仍有效；系统减少动态仅收敛外围效果。
- 当前reset／启动提示保留在`base.css`；历史人物样式随`ArchivedPortrait`懒加载，历史入口和像素字体仍可用。
- `npm test`自动发现当前及历史`test_*.mjs`，避免新测试遗漏于长注册命令。

## 装饰资源

6张原PNG逐字节移到[作者目录](../../assets/generated/pixel-ui/README.md)，不再由静态托管复制。对应完整lossless WebP原字节保留；来源工具与清单记录新位置，历史主题改用相同像素的WebP。

五张下方卡图另有768／1536宽派生与`srcset/sizes`。派生采用nearest采样，再无损编码；它保留采样到的原色，不保留全部原尺寸像素。完整WebP继续作为高DPR候选和fallback，人物与暮色背景不参与这项缩采样。静态／React共享描述，保留固有尺寸、native lazy、空alt和aria-hidden。

```bash
python3 scripts/assets/optimize_pixel_ui.py --verify
python3 scripts/assets/optimize_pixel_ui.py --check
python3 scripts/assets/prepare_responsive_decor.py --verify
python3 scripts/assets/prepare_responsive_decor.py --check
```

## 发布边界

[公开资源清单](../../config/public-assets.json)显式记录经审阅的文件，构建前拒绝未登记路径、符号链接、特殊文件和非发布资料。构建后只接受Vite声明的产物及清单资源，并核对公开资源字节一致；陈旧dist文件也会失败。三个已有历史物理数据文件有精确路径例外，不放行任意binary文件。

新增素材先生成和核验来源，审阅文件名、用途与内容，再手动更新清单。构建不会扫描后自动授权，也不自动删未知文件。临时外部outDir若复用，须对自己拥有的路径显式使用`--emptyOutDir`。此检查防止误发布，并非通用恶意内容检测或绝对安全保证；CSP策略保持。

## 验证与测量

```bash
npm run build
npm run assets:verify
python3 scripts/qa/verify_scenic_motion.py --url http://127.0.0.1:5180/ --output work/scenic-check/motion
python3 scripts/qa/measure_decorations.py --url http://127.0.0.1:5180/ --output work/scenic-check/images
```

检查两种托管base、统一暂停／刷新、系统减少动态、缺失Observer、无JS、键盘、320px布局、原人物节点／相位、历史入口和发布失败边界。Viewport hook在rAF测量，resize后等待它完成再判定稳定布局，不靠隐藏overflow掩盖裁切。

资源测量在相同新浏览器条件下滚动查看全部五张卡图，记录实际currentSrc及encoded字节，不以文件目录大小代替浏览器传输。帧率另在无并行浏览器时独立采样。实际数据见[本轮证据](../../artifacts/scenic-refactor/README.md)，本地结果不代表真实访客网络、物理显示器帧率或绝对安全。
