# fknejdcwnfi · 我的像素小世界

**HELLOWORLD**。我的个人网站，以 Minecraft 风格的高清2D像素圆形呈现 Vermouth，记录作品、兴趣、游戏和社交坐标。

[正式网站](https://fknejdcwnfi.github.io/website/) · [文件入口](docs/README.md) · [日常维护](docs/guides/repository-maintenance.md)

网站使用简体中文和自托管的中英像素字体；当前界面是暮色风景、蓝色页首与圆角奶油色阅读面板。桌面保留章节导航和双侧栏，窄屏使用顶部导航与原生目录。人物仍是原有圆形场景，页面装饰与人物渲染分开。外观与搜索约定见[奶油色界面](docs/guides/cream-scenic-ui.md)和[边框、搜索与作品](docs/guides/ui-consistency.md)。

兴趣图鉴保留《火影忍者》《名侦探柯南》，游戏基地保留王者荣耀；微信、QQ和游戏资料按用户要求先留空。已有真实GitHub和电子邮件继续可用，不展示虚构账号或成绩。

- 社交：微信、QQ、哔哩哔哩、抖音等；可展示账号、复制、主页和可选二维码。
- 兴趣：分类、标签、喜欢的角色、个人感想与本地封面。
- 游戏：自主组合和排序数据、角色收藏、文字、截图及视频链接，选择每块初始展开状态。
- 同一配置生成导航、目录、本地搜索与无JS页面，未填项目自动隐藏。

[当前界面与作品证据](artifacts/ui-consistency/README.md) · [个人模块证据](artifacts/profile-modules/README.md) · [证据索引与适用范围](artifacts/README.md)

[2026-11-08安全、健壮性与性能审计](docs/reports/2026-11-08-audit.md)记录独立复核、已修复问题及验证限制；[本轮原始证据](artifacts/security-audit/README.md)与旧主题证据分别保存。

个人内容从 [site.ts](src/features/profile/content/site.ts)修改。[类型](src/features/profile/content/types.ts)、[配置工厂](src/features/profile/content/site.example.ts)和[个性化模块指南](docs/guides/profile-modules.md)提供完整扩展入口；无需改动画、接数据库或填写游戏密码。

## 开发与验证

使用 `.nvmrc` 指定的 Node24：

```bash
npm ci
npm run dev
npm run build
npm run assets:check
npm run assets:verify
npm run preview -- --host 127.0.0.1 --port 5180
```

开发路径为 `/`，默认production预览为 `http://127.0.0.1:5180/website/`。`build`包含Node测试和strict TypeScript；Sites根路径另用 `VITE_BASE=/ npm run build`。当前界面、个人模块和场景的浏览器检查命令见[工具入口](scripts/README.md)，每轮指定新的输出目录，保留已有证据。测试账号只存在于隔离夹具，不会出现在正常发布内容中。

## 当前结构

```text
src/features/
  profile/
    content/site.ts          真实个人配置
    content/types.ts         社交、兴趣、游戏与内容区块类型
    content/selectors.ts     验证、导航和搜索索引
    content/staticMarkup.ts  同一份内容的无JS页面
    components/              布局、作品及个性化模块
    styles/                  当前creamScenic主题、共享布局与历史主题
  poeticPixel/               唯一默认形象、来源播放与同节点入口
    presentation/            一次原生读回、两帧像素重建与尺寸事件
    atmosphere/              雪、樱花、精灵图集与组合绘制
  referenceScene/            共用圆形UI、播放器与来源时钟
  faithfulPixel/             历史逐帧转制
  calmPortrait/              历史固定人物与小幅后发
  portrait/                 历史近景，显式入口才加载
scripts/assets/              来源转制及完整性核对
scripts/qa/                  production与隔离夹具验证
public/assets/poetic-pixel/   当前衍生素材和来源清单
public/assets/pixel-ui/       页面风景与卡片装饰，不进入人物源像素
public/fonts/                自托管字体、来源与许可证
reference-projects/          不可变的完整原工程
artifacts/                   各轮独立证据，旧目录保持
```

目录责任、当前加载入口及历史资源的发布边界见[仓库维护指南](docs/guides/repository-maintenance.md)。`assets/source/`、`docs/reference/`及原工程文件保持不可变；历史实现和证据不因整理目录而删除。

## Vermouth与原工程

保留圆形里的樱花、富士山和夕阳；96种原画颜色、两次既有颜色Scale2x细化，画布按实际大小／DPR选择1432×1068、2148×1602或最高2864×2136。448片雪与60片粉色花瓣独立飘落，首屏HTML/CSS雪樱不等待影片，保留同节点、相位和180ms气象接手。

原ZIP及22份文件完整保留。原片358×267／12.5fps，48个过渡帧为估计，形成50fps播放；高清放大不创造缺失原画。原生图集一次读回、两帧缓存；详见[当前形象指南](docs/guides/poetic-pixel.md)及`artifacts/scenic-refinement/`，不把历史性能或截图当作新模块的验证。

## 发布

GitHub：[fknejdcwnfi](https://github.com/fknejdcwnfi) · Email：**fknejdcwnfi@gmail.com**。作品只列真实仓库，`xiangqi-review`如实标记为已归档；不虚构职业、所在地或成就。当前中英像素字体为Fusion Pixel，附[来源](public/fonts/FusionPixel-SOURCE.txt)与[SIL OFL](public/fonts/FusionPixel-OFL.txt)；Press Start 2P的[原许可证](public/fonts/OFL.txt)单独保留。

按用户已有授权，任务PR通过检查后自动合并到`main`，由GitHub Actions部署Pages，并核对部署提交。`npm run deploy`是需明确另行要求的手动备用流程，不用于日常发布。

按最新单分支约定，`main`为唯一长期本地／远程分支。任务检查、合并并验证发布后，切回main并删除已确认包含于main的临时分支；独有历史须先保留，禁止强推或丢弃修改。
