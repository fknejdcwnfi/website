import type { GameProfile, GameShowcaseBlock, Interest, SocialProfile } from './types.ts'

/** Configuration helpers only. These are never imported by the website. */
export const wechatProfile = (account: string, qrCode?: string): SocialProfile => ({
  id: 'wechat', platform: 'wechat', label: '微信', handle: account, qrCode,
})
export const qqProfile = (account: string, qrCode?: string): SocialProfile => ({
  id: 'qq', platform: 'qq', label: 'QQ', handle: account, qrCode,
})
export const bilibiliProfile = (spaceUrl: string, publicName: string): SocialProfile => ({
  id: 'bilibili', platform: 'bilibili', label: '哔哩哔哩', href: spaceUrl, handle: publicName,
})
export const douyinProfile = (profileUrl: string, publicName: string): SocialProfile => ({
  id: 'douyin', platform: 'douyin', label: '抖音', href: profileUrl, handle: publicName,
})
export const honorOfKingsProfile = (publicPlayerName?: string, region?: string): GameProfile => ({
  id: 'honor-of-kings', game: 'honor-of-kings', label: '王者荣耀', playerName: publicPlayerName, region,
  description: '峡谷里的对局、英雄与精彩瞬间。', tags: ['MOBA', '团队竞技'], blocks: [],
})
export const narutoProfile = (publicPlayerName?: string, region?: string): GameProfile => ({
  id: 'naruto-game', game: 'naruto', label: '火影忍者手游', playerName: publicPlayerName, region,
  description: '忍者与对局的游戏记录。', blocks: [],
})
export const animeInterest = (id: string, title: string, description?: string): Interest => ({
  id, title, category: 'anime', description, tags: ['动漫'], favorites: [],
})
/** Use any labels and order; values come from your own public content. */
export const factsBlock = (id: string, title: string, items: { label: string; value: string }[]): GameShowcaseBlock => ({
  id, kind: 'facts', title, items, expanded: true,
})
export const collectionBlock = (id: string, title: string, items: { name: string; note?: string }[]): GameShowcaseBlock => ({
  id, kind: 'collection', title, items,
})
export const notesBlock = (id: string, title: string, text: string): GameShowcaseBlock => ({ id, kind: 'notes', title, text })
export const galleryBlock = (id: string, title: string, items: { title: string; src: string; description?: string; href?: string }[]): GameShowcaseBlock => ({
  id, kind: 'gallery', title, items,
})
export const linksBlock = (id: string, title: string, items: { title: string; href: string; description?: string }[]): GameShowcaseBlock => ({
  id, kind: 'links', title, items,
})
