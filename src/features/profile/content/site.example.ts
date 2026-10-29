import type { GameProfile, SocialProfile } from './site.ts'

/**
 * Configuration guide only: these factories are never imported by the website.
 * Replace every argument with your own confirmed, public information before
 * adding a result to site.socials or site.gameProfiles in site.ts.
 */
export const bilibiliProfile = (spaceUrl: string, publicName: string): SocialProfile => ({
  id: 'bilibili', platform: 'bilibili', label: 'B站 / Bilibili', href: spaceUrl, handle: publicName,
})

export const douyinProfile = (profileUrl: string, publicName: string): SocialProfile => ({
  id: 'douyin', platform: 'douyin', label: '抖音 / Douyin', href: profileUrl, handle: publicName,
})

export const honorOfKingsProfile = (publicPlayerName: string, region?: string): GameProfile => ({
  id: 'honor-of-kings', game: 'honor-of-kings', label: '王者荣耀', playerName: publicPlayerName, region,
})

export const narutoProfile = (publicPlayerName: string, region?: string): GameProfile => ({
  id: 'naruto', game: 'naruto', label: '火影忍者', playerName: publicPlayerName, region,
})
