/** Public profile data. Artwork and animation stay independent of these modules. */
export type Project = {
  id: string; title: string; subtitle: string; description: string
  tags: string[]; href: string; status: 'active' | 'archived'
}
export type SocialPlatform = 'wechat' | 'qq' | 'bilibili' | 'douyin' | 'weibo' | 'xiaohongshu' | 'telegram' | 'discord' | 'other'
export type SocialProfile = {
  id: string; platform: SocialPlatform; label: string
  handle?: string; href?: string; description?: string
  /** Relative file in public/, e.g. media/profile/wechat.png. */
  qrCode?: string
}
export type ContactLink = Omit<SocialProfile, 'platform'> & { platform: SocialPlatform | 'github' | 'email' }
export type Interest = {
  id: string; title: string; category: 'anime' | 'manga' | 'music' | 'other'
  description?: string; tags?: string[]; favorites?: string[]; note?: string
  href?: string; cover?: string
}
/** Order, labels and contents of each block belong to the owner. Empty blocks stay hidden. */
type ShowcaseBlockOptions = { expanded?: boolean }
export type GameShowcaseBlock = ShowcaseBlockOptions & (
  | { id: string; kind: 'facts'; title: string; items: { label: string; value: string }[] }
  | { id: string; kind: 'collection'; title: string; items: { name: string; note?: string }[] }
  | { id: string; kind: 'notes'; title: string; text: string }
  | { id: string; kind: 'gallery'; title: string; items: { title: string; src: string; description?: string; href?: string }[] }
  | { id: string; kind: 'links'; title: string; items: { title: string; href: string; description?: string }[] }
)
export type GameProfile = {
  id: string; game: 'honor-of-kings' | 'naruto' | 'other'; label: string
  playerName?: string; playerId?: string; region?: string; description?: string; href?: string
  tagline?: string; tags?: string[]; cover?: string; blocks?: GameShowcaseBlock[]
}
export type SiteContent = {
  name: string; fullName: string; handle: string; intro: string; tagline: string
  about: string[]; github: string; email?: string; projects: Project[]
  navigation: { label: string; href: string }[]
  socials?: SocialProfile[]; interests?: Interest[]; gameProfiles?: GameProfile[]
}
export type ContentsEntry = { label: string; href: string; symbol: string }
export type SiteSearchEntry = { id: string; title: string; href: string; excerpt: string; text: string }
