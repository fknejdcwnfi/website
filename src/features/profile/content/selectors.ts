import type { ContactLink, ContentsEntry, GameProfile, GameShowcaseBlock, Interest, SiteContent, SiteSearchEntry, SocialPlatform } from './types.ts'

const text = (value: string | undefined): string => value?.trim() ?? ''
const validId = (value: string): boolean => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
const strings = (values: string[] | undefined): string[] => [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))]
const unique = <T extends { id: string }>(values: T[]): T[] => values.filter((value, index) =>
  values.findIndex(candidate => candidate.id === value.id) === index)

export const isPublicLink = (href: string | undefined): boolean => {
  try {
    const url = new URL(href ?? '')
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}
const publicLink = (href: string | undefined): string | undefined => isPublicLink(href) ? new URL(href!).href : undefined

/** Media is opt-in and local: no trackers, remote embeds, traversal or executable URLs. */
const localMedia = (path: string | undefined): string | undefined => {
  if (!path || !/^[a-z0-9][a-z0-9._/-]*\.(?:png|jpe?g|webp|avif|gif)$/i.test(path) ||
    path.split('/').some(segment => !segment || segment === '.' || segment === '..')) return undefined
  return path
}
export const resolveProfileAsset = (path: string | undefined, base = '/'): string | undefined => {
  const safe = localMedia(path)
  return safe ? `${base.endsWith('/') ? base : `${base}/`}${safe}` : undefined
}

const platforms: readonly SocialPlatform[] = ['wechat', 'qq', 'bilibili', 'douyin', 'weibo', 'xiaohongshu', 'telegram', 'discord', 'other']
export const getSocialLinks = (content: SiteContent): ContactLink[] => {
  const github: ContactLink[] = isPublicLink(content.github) ? [{ id: 'github', platform: 'github', label: 'GitHub', href: content.github, handle: `@${content.handle}` }] : []
  const address = text(content.email)
  const email: ContactLink[] = /^[^\s@<>?#]+@[^\s@<>?#]+\.[^\s@<>?#]+$/.test(address)
    ? [{ id: 'email', platform: 'email', label: '电子邮件', href: `mailto:${encodeURIComponent(address).replace('%40', '@')}`, handle: address }] : []
  const profiles: ContactLink[] = (content.socials ?? [])
    .filter(profile => validId(profile.id) && text(profile.label))
    .map(profile => ({ ...profile, platform: platforms.includes(profile.platform) ? profile.platform : 'other' as const,
      label: text(profile.label), handle: text(profile.handle) || undefined, description: text(profile.description) || undefined,
      href: publicLink(profile.href), qrCode: localMedia(profile.qrCode) }))
    .filter(profile => Boolean(profile.href || profile.handle || profile.qrCode))
  return unique([...github, ...email, ...profiles])
}

export const getInterests = (content: SiteContent): Interest[] => unique((content.interests ?? [])
  .filter(interest => validId(interest.id) && text(interest.title))
  .map(interest => ({ ...interest, title: text(interest.title),
    category: ['anime', 'manga', 'music', 'other'].includes(interest.category) ? interest.category : 'other',
    description: text(interest.description) || undefined, note: text(interest.note) || undefined,
    tags: strings(interest.tags), favorites: strings(interest.favorites),
    href: publicLink(interest.href), cover: localMedia(interest.cover) })))

const getShowcaseBlocks = (blocks: GameShowcaseBlock[] | undefined): GameShowcaseBlock[] => {
  const result: GameShowcaseBlock[] = []
  for (const block of blocks ?? []) {
    if (!validId(block.id) || !text(block.title)) continue
    const base = { id: block.id, title: text(block.title), expanded: block.expanded === true }
    switch (block.kind) {
      case 'facts': {
        const items = block.items.filter(item => text(item.label) && text(item.value))
          .map(item => ({ label: text(item.label), value: text(item.value) }))
        if (items.length) result.push({ ...base, kind: 'facts', items })
        break
      }
      case 'collection': {
        const items = block.items.filter(item => text(item.name))
          .map(item => ({ name: text(item.name), note: text(item.note) || undefined }))
        if (items.length) result.push({ ...base, kind: 'collection', items })
        break
      }
      case 'notes':
        if (text(block.text)) result.push({ ...base, kind: 'notes', text: text(block.text) })
        break
      case 'gallery': {
        const items = block.items.filter(item => text(item.title) && localMedia(item.src))
          .map(item => ({ title: text(item.title), src: localMedia(item.src)!,
            description: text(item.description) || undefined, href: publicLink(item.href) }))
        if (items.length) result.push({ ...base, kind: 'gallery', items })
        break
      }
      case 'links': {
        const items = block.items.filter(item => text(item.title) && isPublicLink(item.href))
          .map(item => ({ title: text(item.title), href: publicLink(item.href)!, description: text(item.description) || undefined }))
        if (items.length) result.push({ ...base, kind: 'links', items })
        break
      }
    }
  }
  return unique(result)
}

/** A game can have its own public content without publishing a player account. */
export const getGameProfiles = (content: SiteContent): GameProfile[] => unique((content.gameProfiles ?? [])
  .filter(profile => validId(profile.id) && text(profile.label))
  .map(profile => ({ ...profile, label: text(profile.label), playerName: text(profile.playerName) || undefined,
    playerId: text(profile.playerId) || undefined, region: text(profile.region) || undefined,
    description: text(profile.description) || undefined, tagline: text(profile.tagline) || undefined,
    tags: strings(profile.tags), cover: localMedia(profile.cover), href: publicLink(profile.href), blocks: getShowcaseBlocks(profile.blocks) }))
  .filter(profile => Boolean(profile.playerName || profile.playerId || profile.region || profile.description || profile.tagline ||
    profile.tags.length || profile.cover || profile.href || profile.blocks.length)))

export const getSiteNavigation = (content: SiteContent): SiteContent['navigation'] => {
  const navigation = content.navigation.filter(link => link.href !== '#games' && link.href !== '#interests')
  const modules = [
    ...(getInterests(content).length ? [{ label: '兴趣', href: '#interests' }] : []),
    ...(getGameProfiles(content).length ? [{ label: '游戏', href: '#games' }] : []),
  ]
  const contactIndex = navigation.findIndex(link => link.href === '#contact')
  navigation.splice(contactIndex < 0 ? navigation.length : contactIndex, 0, ...modules)
  return navigation
}
export const getTableOfContents = (content: SiteContent): ContentsEntry[] => [
  { label: '欢迎来到我的网站', href: '#home', symbol: '👋' },
  { label: '关于我', href: '#about', symbol: '📖' },
  { label: '作品与实验', href: '#work', symbol: '🧩' },
  ...(getInterests(content).length ? [{ label: '兴趣图鉴', href: '#interests', symbol: '✦' }] : []),
  ...(getGameProfiles(content).length ? [{ label: '游戏基地', href: '#games', symbol: '🎮' }] : []),
  { label: '社交坐标', href: '#contact', symbol: '✉' },
]
const blockText = (block: GameShowcaseBlock): string => {
  switch (block.kind) {
    case 'facts': return block.items.map(item => `${item.label} ${item.value}`).join(' ')
    case 'collection': return block.items.map(item => `${item.name} ${item.note ?? ''}`).join(' ')
    case 'notes': return block.text
    case 'gallery': case 'links': return block.items.map(item => `${item.title} ${item.description ?? ''}`).join(' ')
  }
}
export const getSiteSearchEntries = (content: SiteContent): SiteSearchEntry[] => [
  { id: 'home', title: content.intro, href: '#home', excerpt: content.tagline, text: `${content.name} ${content.intro} ${content.tagline} Vermouth 像素肖像` },
  { id: 'about', title: '关于我', href: '#about', excerpt: content.about[0] ?? '', text: content.about.join(' ') },
  ...content.projects.map(project => ({ id: project.id, title: project.title, href: `#project-${project.id}`, excerpt: project.subtitle,
    text: `${project.title} ${project.subtitle} ${project.description} ${project.tags.join(' ')} ${project.status === 'active' ? '持续制作中' : '已归档'}` })),
  ...getInterests(content).map(interest => ({ id: `interest-${interest.id}`, title: interest.title, href: `#interest-${interest.id}`,
    excerpt: interest.description ?? '兴趣图鉴', text: `${interest.title} ${interest.description ?? ''} ${(interest.tags ?? []).join(' ')} ${(interest.favorites ?? []).join(' ')} ${interest.note ?? ''}` })),
  ...getGameProfiles(content).map(profile => ({ id: `game-${profile.id}`, title: profile.label, href: `#game-${profile.id}`,
    excerpt: profile.tagline ?? profile.description ?? '游戏基地', text: `${profile.label} ${profile.playerName ?? ''} ${profile.playerId ?? ''} ${profile.region ?? ''} ${profile.description ?? ''} ${profile.tagline ?? ''} ${(profile.tags ?? []).join(' ')} ${(profile.blocks ?? []).map(block => `${block.title} ${blockText(block)}`).join(' ')}` })),
  { id: 'contact', title: '社交坐标', href: '#contact', excerpt: content.email ?? content.github,
    text: getSocialLinks(content).map(profile => `${profile.label} ${profile.handle ?? ''} ${profile.description ?? ''}`).join(' ') },
]

/** Literal tokens only: queries never become regular expressions, HTML or requests. */
export const searchSite = (entries: SiteSearchEntry[], query: string): SiteSearchEntry[] => {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter(entry => tokens.every(token => `${entry.title} ${entry.text}`.toLocaleLowerCase().includes(token))).slice(0, 8)
}
