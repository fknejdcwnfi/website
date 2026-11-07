import type { SiteContent } from './types.ts'
export type { Project, SocialPlatform, SocialProfile, ContactLink, Interest, GameProfile, GameShowcaseBlock, SiteContent, ContentsEntry, SiteSearchEntry } from './types.ts'
export { getProjects, getSocialLinks, getInterests, getGameProfiles, getSiteNavigation, getTableOfContents, getSiteSearchEntries, searchSite, resolveProfileAsset } from './selectors.ts'

/** Edit public content here. Empty accounts and custom blocks are intentionally hidden. */
export const site: SiteContent = {
  name: 'fknejdcwnfi', fullName: 'fknejdcwnfi', handle: 'fknejdcwnfi', intro: 'HELLOWORLD',
  tagline: '把好奇心，慢慢做成作品。欢迎来到我的像素小世界。',
  about: [
    '你好，我是 fknejdcwnfi。HELLOWORLD，欢迎来到我的像素小世界。',
    '从 Java 的象棋项目，到这个结合像素美术与前端动态的网站，我想把想法一步步做成可以看见、可以使用的东西。',
    '这里也留了一些位置，收藏喜欢的动漫、游戏和日常灵感。',
  ],
  github: 'https://github.com/fknejdcwnfi', email: 'fknejdcwnfi@gmail.com',
  // The owner will supply WeChat, QQ and other public accounts later. Never invent them.
  socials: [],
  interests: [
    { id: 'naruto', title: '火影忍者', category: 'anime', description: '忍者世界里的羁绊与成长。', tags: ['动漫', '热血', '羁绊'] },
    { id: 'detective-conan', title: '名侦探柯南', category: 'anime', description: '推理、悬念与角色故事。', tags: ['动漫', '推理', '悬念'] },
  ],
  // Player name, ID, region, rank, favorite heroes and media remain blank until supplied.
  gameProfiles: [
    { id: 'honor-of-kings', game: 'honor-of-kings', label: '王者荣耀', description: '峡谷里的对局、英雄与精彩瞬间。', tags: ['MOBA', '团队竞技'], blocks: [] },
  ],
  navigation: [
    { label: '首页', href: '#home' }, { label: '关于', href: '#about' },
    { label: '作品', href: '#work' }, { label: '社交', href: '#contact' },
  ],
  projects: [
    { id: 'living-portrait', title: 'Living Portrait', subtitle: '个人网站 · 像素动态实验',
      description: '将 Vermouth 原动画转成高清像素画，保留樱花与富士山，让飘发、眨眼、细雪与粉色花瓣连贯流动。',
      tags: ['TypeScript', 'React', 'Canvas', 'Vite'], href: 'https://github.com/fknejdcwnfi/website', status: 'active',
      kind: '个人网站', year: 2026,
      highlights: [
        '从原动画保留人物动作与场景，以固定色板重建像素画面。',
        '细雪与粉色花瓣独立流动，尊重减少动态偏好。',
        '包含本地搜索、章节导航与响应式布局；无 JavaScript 时仍可阅读主要内容。',
      ],
      note: '持续完善像素表现、页面内容与浏览体验。' },
    { id: 'xiangqi-review', title: 'Xiangqi Review', subtitle: 'Java · 象棋项目',
      description: '以 Java 与 Swing 制作的象棋开发原型，保留棋盘交互与规则探索。目前已归档。',
      tags: ['Java 8', 'Swing', 'Maven'], href: 'https://github.com/fknejdcwnfi/xiangqi-review', status: 'archived',
      kind: '桌面原型', year: 2026,
      highlights: [
        '使用 Swing 绘制棋盘、楚河汉界与红黑棋子。',
        '通过鼠标点击选择棋子、尝试移动，并显示选中边角。',
        '兵卒实现过河前后的基础移动规则，棋盘模型与界面分层。',
      ],
      note: '保留开发阶段源码；将帅规则等仍待补全。' },
  ],
}
