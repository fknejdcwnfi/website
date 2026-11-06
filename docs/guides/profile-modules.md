# 社交、兴趣与游戏模块

2026-11-06：在现有个人网站上新增可配置模块，页面、搜索、替代文字、提示和 metadata 使用简体中文（`zh-CN`）。保留靛蓝文档布局、Minecraft 风格方形像素面板和现有圆形 Vermouth；不改动画及原工程。

用户指定的《火影忍者》《名侦探柯南》加入兴趣图鉴，王者荣耀加入游戏基地。用户明确要求其他账号和游戏资料稍后提供，因此微信、QQ、区服、段位、英雄、截图和视频均未代填；没有空行、假成绩或无效按钮。

## 修改入口

只需编辑 [site.ts](../../src/features/profile/content/site.ts)，不用改播放器或组件。

| 文件 | 职责 |
| --- | --- |
| `content/site.ts` | 真实公开内容、模块顺序和项目 |
| `content/types.ts` | 社交、兴趣、游戏和自定义区块的 TypeScript 类型 |
| `content/selectors.ts` | 内容清理、链接和本地媒体验证、导航和搜索索引 |
| `content/site.example.ts` | 可选的配置工厂；不会被网站加载 |
| `components/ProfileModules.tsx` | 兴趣、游戏、社交、复制反馈与原生展开区域 |
| `components/PersonalSections.tsx` | 关于、作品及模块组合 |
| `content/staticMarkup.ts` | 同一配置生成的无 JavaScript 页面 |
| `styles/sections.css` | 方形物品栏面板、标签、内容区及响应式布局 |

空的可选模块不加入导航和目录。ID使用小写英文、数字与单连字符，每项唯一；数组顺序就是展示顺序。所有内容按纯文本渲染，不支持任意 HTML。

## 社交账号

`socials` 支持微信、QQ、哔哩哔哩、抖音、微博、小红书、Telegram、Discord 和其他平台。每项填写 `id`、`platform`、`label`，再提供以下至少一种：

| 字段 | 用途 |
| --- | --- |
| `handle` | 公开账号或昵称；无需伪造个人主页链接，支持复制 |
| `href` | 真实 HTTPS 主页；不允许脚本协议或含密码的链接 |
| `qrCode` | 可选本地二维码图片路径 |
| `description` | 可选的联系说明 |

GitHub与电子邮件仍取自顶层 `github`、`email`。未填写的社交账号不显示。复制成功须等浏览器确认；无权限或 API 不可用时选中账号文字并提示手动复制，不假报成功。二维码使用原生 `<details>`，键盘和无 JS 均可展开。

例如稍后收到真实资料后，将一项加入 `socials`：

```ts
{
  id: 'wechat',
  platform: 'wechat',
  label: '微信',
  handle: '', // 填入愿意公开的真实账号
  // qrCode: 'media/profile/wechat.png',
}
```

空字符串不会产生账号卡片。这里没有生成真实二维码；有二维码图片时再放入 `public/media/profile/` 并填写路径。

## 兴趣图鉴

`interests` 每项必填 `id`、`title`、`category`（`anime`／`manga`／`music`／`other`）。可选：

- `description`：简介；`tags`：标签。
- `favorites`：喜欢的角色、作品或曲目，按你的文字展示。
- `note`：个人感想；`href`：HTTPS 延伸链接。
- `cover`：本地封面图片。

可以继续加入动漫、漫画、音乐和其他兴趣；不需要另写一套页面。

## 游戏个性化展示

`gameProfiles` 每项有 `id`、`game`（`honor-of-kings`／`naruto`／`other`）、`label`。名称、简介、标签和内容可独立展示，不要求公开玩家ID。

可选 `playerName`、`playerId`、`region`、`tagline`、`description`、`tags`、`cover` 和 `href`。缺项自动隐藏，不生成空白数据行。

`blocks` 是按顺序排列的自定义内容；所有标题、标签、数据和文字均由你填写。

| `kind` | 字段 | 可以放什么 |
| --- | --- | --- |
| `facts` | `items: [{ label, value }]` | 段位、赛季、位置、游戏时段或任意数据 |
| `collection` | `items: [{ name, note? }]` | 本命英雄、忍者、皮肤、搭配或收藏 |
| `notes` | `text` | 游戏感想、玩法说明、日记；保留换行 |
| `gallery` | `items: [{ title, src, description?, href? }]` | 本地截图、卡片或图片记录 |
| `links` | `items: [{ title, href, description? }]` | 精彩视频、攻略或其他 HTTPS 链接 |

每个区块还有 `id`、`title`，以及可选的 `expanded: true`（初始展开）。默认折叠；访客可自由开合，停用 JS 仍可用。你可以新增、移除、改名、排序和选择展开状态，不局限于固定段位卡。

以下是空的结构模板，不会作为真实成绩发布：

```ts
blocks: [
  { id: 'season', kind: 'facts', title: '本赛季', expanded: true, items: [] },
  { id: 'heroes', kind: 'collection', title: '本命英雄', items: [] },
  { id: 'journal', kind: 'notes', title: '游戏手记', text: '' },
  { id: 'moments', kind: 'gallery', title: '精彩瞬间', items: [] },
  { id: 'videos', kind: 'links', title: '视频收藏', items: [] },
]
```

空区块不会展示。视频以链接打开，不自动嵌入远程播放器；这里没有连接王者荣耀等游戏的实时数据接口，也不需要输入游戏密码。

## 图片路径与搜索

二维码、封面、画廊图片放在 `public/` 下，配置填写相对路径，例如 `media/profile/moment.webp`。支持PNG、JPEG、WebP、AVIF和GIF；禁止远程图片、SVG、路径穿越和查询参数。构建自动适配 `/website/`，不把根域名路径写死。

搜索索引包含兴趣标签、角色收藏、游戏数据、说明和链接标题，所有跳转均指向实际存在的卡片或章节。搜索只在本地运行，不上传查询。目录、导航、React和无JS页面共用同一份配置。

## 验证

```bash
npm run build
npm run assets:verify
npm run preview -- --host 127.0.0.1 --port 5180
npm run profile:qa
```

新证据在 `artifacts/profile-modules/`；账号、二维码和游戏内容的合成测试只在隔离夹具构建中使用，不进入正常网站。原形象证据仍保留在 `artifacts/scenic-refinement/`。原工程、素材与GitHub Actions工作流不修改；通过CI后按现有授权合并并发布。

本轮109项Node测试、strict TypeScript／production build及资产核对通过。[269项浏览器检查](../../artifacts/profile-modules/checks.json)覆盖1440／768／390／320px、简体中文、导航搜索、空账号、无JS、五类游戏区块、独立区服／主页、展开配置、复制成功和拒绝、二维码与本地媒体，以及原形象／雪樱／减少动态／离屏暂停。未发现浏览器错误、异常HTTP响应或外部资源请求。截图中标明QA的数据仅为合成夹具，不是用户资料。
