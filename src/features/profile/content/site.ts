/** Edit personal content here; portrait geometry and animation remain independent. */
export type Project = {
  id: string
  title: string
  subtitle: string
  description: string
  tags: string[]
  href: string
  status: 'active' | 'archived'
}

/** Additional, owner-confirmed accounts. GitHub and email come from the fields below. */
export type SocialProfile = {
  id: string
  platform: 'bilibili' | 'douyin' | 'other'
  label: string
  href: string
  handle?: string
}

export type ContactLink = Omit<SocialProfile, 'platform'> & {
  platform: SocialProfile['platform'] | 'github' | 'email'
}

/** Supply a real public player name or ID; games never require a link to be useful. */
export type GameProfile = {
  id: string
  game: 'honor-of-kings' | 'naruto' | 'other'
  label: string
  playerName?: string
  playerId?: string
  region?: string
  description?: string
  href?: string
}

export type SiteContent = {
  name: string
  fullName: string
  handle: string
  intro: string
  tagline: string
  about: string[]
  github: string
  email?: string
  projects: Project[]
  navigation: { label: string; href: string }[]
  socials?: SocialProfile[]
  gameProfiles?: GameProfile[]
}

const isPublicLink = (href: string): boolean => {
  try { return new URL(href).protocol === 'https:' }
  catch { return false }
}

export const getSocialLinks = (content: SiteContent): ContactLink[] => [
  ...(isPublicLink(content.github)
    ? [{ id: 'github', platform: 'github' as const, label: 'GitHub', href: content.github, handle: `@${content.handle}` }]
    : []),
  ...(content.email?.trim()
    ? [{ id: 'email', platform: 'email' as const, label: 'Email', href: `mailto:${content.email}`, handle: content.email }]
    : []),
  ...(content.socials ?? []).filter((profile) => profile.id.trim() && profile.label.trim() && isPublicLink(profile.href)),
]

export const getGameProfiles = (content: SiteContent): GameProfile[] => (content.gameProfiles ?? [])
  .filter((profile) => profile.id.trim() && profile.label.trim() && (profile.playerName?.trim() || profile.playerId?.trim()))
  .map((profile) => ({ ...profile, href: profile.href && isPublicLink(profile.href) ? profile.href : undefined }))

/** An optional section adds its own working anchor; an empty configuration adds no navigation. */
export const getSiteNavigation = (content: SiteContent): SiteContent['navigation'] => {
  const navigation = content.navigation.filter((link) => link.href !== '#games')
  if (!getGameProfiles(content).length) return navigation
  const contactIndex = navigation.findIndex((link) => link.href === '#contact')
  navigation.splice(contactIndex < 0 ? navigation.length : contactIndex, 0, { label: '遊戲', href: '#games' })
  return navigation
}

// Name, greeting and email were supplied by the owner; project links are real public repositories.
// No invented job title, location, client work or social accounts.
export const site: SiteContent = {
  name: 'fknejdcwnfi',
  fullName: 'fknejdcwnfi',
  handle: 'fknejdcwnfi',
  intro: 'HELLOWORLD',
  tagline: '把好奇心，慢慢做成作品。歡迎來到我的像素小世界。',
  about: [
    '你好，我是 fknejdcwnfi。HELLOWORLD，歡迎來到我的像素小世界。',
    '從 Java 的象棋專案，到這個結合像素美術與前端動態的網站，我想把想法一步步做成可以看見、可以使用的東西。',
  ],
  github: 'https://github.com/fknejdcwnfi',
  email: 'fknejdcwnfi@gmail.com',
  // Add only confirmed accounts / public player details. Empty lists create no placeholder UI.
  socials: [],
  gameProfiles: [],
  navigation: [
    { label: '關於', href: '#about' },
    { label: '作品', href: '#work' },
    { label: '聯絡', href: '#contact' },
  ],
  projects: [
    {
      id: 'living-portrait',
      title: 'Living Portrait',
      subtitle: '個人網站 · 像素動態實驗',
      description: '把 Vermouth 的像素肖像帶進個人網站，讓微風、眨眼與飾物在同一個角色上自然發生。',
      tags: ['TypeScript', 'React', 'Canvas'],
      href: 'https://github.com/fknejdcwnfi/website',
      status: 'active',
    },
    {
      id: 'xiangqi-review',
      title: 'Xiangqi Review',
      subtitle: 'Java · 象棋專案',
      description: '一段以 Java 製作象棋專案的開發嘗試。目前已封存，保留程式碼與當時的探索。',
      tags: ['Java', 'Xiangqi', 'Archive'],
      href: 'https://github.com/fknejdcwnfi/xiangqi-review',
      status: 'archived',
    },
  ],
}
