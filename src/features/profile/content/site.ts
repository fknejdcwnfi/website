import type { SiteContent } from './types.ts'
export type { Project, SocialPlatform, SocialProfile, ContactLink, Interest, GameProfile, GameShowcaseBlock, SiteContent, ContentsEntry, SiteSearchEntry } from './types.ts'
export { getSocialLinks, getInterests, getGameProfiles, getSiteNavigation, getTableOfContents, getSiteSearchEntries, searchSite, resolveProfileAsset } from './selectors.ts'

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
      tags: ['TypeScript', 'React', 'Canvas'], href: 'https://github.com/fknejdcwnfi/website', status: 'active' },
    { id: 'xiangqi-review', title: 'Xiangqi Review', subtitle: 'Java · 象棋项目',
      description: '一段以 Java 制作象棋项目的开发尝试。目前已归档，保留代码与当时的探索。',
      tags: ['Java', 'Xiangqi', 'Archive'], href: 'https://github.com/fknejdcwnfi/xiangqi-review', status: 'archived' },
  ],
}
