import type { ContactLink, ContentsEntry, GameProfile, GameShowcaseBlock, Interest, Project, SiteContent, SiteSearchEntry, SocialPlatform } from './types.ts'

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
const strings = (values: unknown): string[] => [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))]
const records = <T>(values: unknown): T[] => (Array.isArray(values) ? values : [])
  .filter(value => value !== null && typeof value === 'object' && !Array.isArray(value)) as T[]
const unique = <T extends { id: string }>(values: T[]): T[] => values.filter((value, index) =>
  values.findIndex(candidate => candidate.id === value.id) === index)

export const isPublicLink = (href: unknown): boolean => {
  try {
    if (typeof href !== 'string') return false
    const url = new URL(href)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}
const publicLink = (href: unknown): string | undefined => isPublicLink(href) ? new URL(href as string).href : undefined

/** The owner profile is shared by every GitHub link, including the no-JS page. */
export const getSiteGithub = (content: SiteContent): string | undefined => {
  const href = publicLink(content.github)
  if (!href) return undefined
  const url = new URL(href)
  const owner = /^\/([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)\/?$/i.exec(url.pathname)?.[1]
  return url.hostname === 'github.com' && !url.port && owner ? `https://github.com/${owner}` : undefined
}
export const getSiteRepository = (content: SiteContent): string | undefined => {
  const github = getSiteGithub(content)
  return github ? `${github}/website` : undefined
}

const boundedText = (value: unknown, limit: number): string => text(value).slice(0, limit)
/** Project cards and search share the same bounded, public source data. */
export const getProjects = (content: SiteContent): Project[] => unique(records<Project>(content.projects)
  .filter(project => validId(project.id) && project.id.length <= 80 && text(project.title) &&
    isPublicLink(project.href) && ['active', 'archived'].includes(project.status))
  .map(project => ({ ...project, title: boundedText(project.title, 100),
    subtitle: boundedText(project.subtitle, 120), description: boundedText(project.description, 400),
    tags: strings(strings(project.tags).map(tag => boundedText(tag, 32))).slice(0, 8), href: publicLink(project.href)!,
    kind: boundedText(project.kind, 40) || undefined,
    year: Number.isInteger(project.year) && project.year! >= 1970 && project.year! <= 2100 ? project.year : undefined,
    highlights: strings(strings(project.highlights).map(item => boundedText(item, 180))).slice(0, 4),
    note: boundedText(project.note, 240) || undefined })))

/** Media is opt-in and local: no trackers, remote embeds, traversal or executable URLs. */
const localMedia = (path: unknown): string | undefined => {
  if (typeof path !== 'string' || !/^[a-z0-9][a-z0-9._/-]*\.(?:png|jpe?g|webp|avif|gif)$/i.test(path) ||
    path.split('/').some(segment => !segment || segment === '.' || segment === '..')) return undefined
  return path
}
export const resolveProfileAsset = (path: unknown, base = '/'): string | undefined => {
  const safe = localMedia(path)
  return safe ? `${base.endsWith('/') ? base : `${base}/`}${safe}` : undefined
}

const platforms: readonly SocialPlatform[] = ['wechat', 'qq', 'bilibili', 'douyin', 'weibo', 'xiaohongshu', 'telegram', 'discord', 'other']
export const getSocialLinks = (content: SiteContent): ContactLink[] => {
  const githubHref = getSiteGithub(content)
  const github: ContactLink[] = githubHref ? [{ id: 'github', platform: 'github', label: 'GitHub', href: githubHref, handle: `@${text(content.handle)}` }] : []
  const address = text(content.email)
  const email: ContactLink[] = /^[^\s@<>?#]+@[^\s@<>?#]+\.[^\s@<>?#]+$/.test(address)
    ? [{ id: 'email', platform: 'email', label: '电子邮件', href: `mailto:${encodeURIComponent(address).replace('%40', '@')}`, handle: address }] : []
  const profiles: ContactLink[] = records<NonNullable<SiteContent['socials']>[number]>(content.socials)
    .filter(profile => validId(profile.id) && text(profile.label))
    .map(profile => ({ ...profile, platform: platforms.includes(profile.platform) ? profile.platform : 'other' as const,
      label: text(profile.label), handle: text(profile.handle) || undefined, description: text(profile.description) || undefined,
      href: publicLink(profile.href), qrCode: localMedia(profile.qrCode) }))
    .filter(profile => Boolean(profile.href || profile.handle || profile.qrCode))
  return unique([...github, ...email, ...profiles])
}

export const getInterests = (content: SiteContent): Interest[] => unique(records<Interest>(content.interests)
  .filter(interest => validId(interest.id) && text(interest.title))
  .map(interest => ({ ...interest, title: text(interest.title),
    category: ['anime', 'manga', 'music', 'other'].includes(interest.category) ? interest.category : 'other',
    description: text(interest.description) || undefined, note: text(interest.note) || undefined,
    tags: strings(interest.tags), favorites: strings(interest.favorites),
    href: publicLink(interest.href), cover: localMedia(interest.cover) })))

const getShowcaseBlocks = (blocks: GameShowcaseBlock[] | undefined): GameShowcaseBlock[] => {
  const result: GameShowcaseBlock[] = []
  for (const block of records<GameShowcaseBlock>(blocks)) {
    if (!validId(block.id) || !text(block.title)) continue
    const base = { id: block.id, title: text(block.title), expanded: block.expanded === true }
    switch (block.kind) {
      case 'facts': {
        const items = records<typeof block.items[number]>(block.items).filter(item => text(item.label) && text(item.value))
          .map(item => ({ label: text(item.label), value: text(item.value) }))
        if (items.length) result.push({ ...base, kind: 'facts', items })
        break
      }
      case 'collection': {
        const items = records<typeof block.items[number]>(block.items).filter(item => text(item.name))
          .map(item => ({ name: text(item.name), note: text(item.note) || undefined }))
        if (items.length) result.push({ ...base, kind: 'collection', items })
        break
      }
      case 'notes':
        if (text(block.text)) result.push({ ...base, kind: 'notes', text: text(block.text) })
        break
      case 'gallery': {
        const items = records<typeof block.items[number]>(block.items).filter(item => text(item.title) && localMedia(item.src))
          .map(item => ({ title: text(item.title), src: localMedia(item.src)!,
            description: text(item.description) || undefined, href: publicLink(item.href) }))
        if (items.length) result.push({ ...base, kind: 'gallery', items })
        break
      }
      case 'links': {
        const items = records<typeof block.items[number]>(block.items).filter(item => text(item.title) && isPublicLink(item.href))
          .map(item => ({ title: text(item.title), href: publicLink(item.href)!, description: text(item.description) || undefined }))
        if (items.length) result.push({ ...base, kind: 'links', items })
        break
      }
    }
  }
  return unique(result)
}

/** A game can have its own public content without publishing a player account. */
export const getGameProfiles = (content: SiteContent): GameProfile[] => unique(records<GameProfile>(content.gameProfiles)
  .filter(profile => validId(profile.id) && text(profile.label))
  .map(profile => ({ ...profile, game: ['honor-of-kings', 'naruto', 'other'].includes(profile.game) ? profile.game : 'other' as const,
    label: text(profile.label), playerName: text(profile.playerName) || undefined,
    playerId: text(profile.playerId) || undefined, region: text(profile.region) || undefined,
    description: text(profile.description) || undefined, tagline: text(profile.tagline) || undefined,
    tags: strings(profile.tags), cover: localMedia(profile.cover), href: publicLink(profile.href), blocks: getShowcaseBlocks(profile.blocks) }))
  .filter(profile => Boolean(profile.playerName || profile.playerId || profile.region || profile.description || profile.tagline ||
    profile.tags.length || profile.cover || profile.href || profile.blocks.length)))

export const getSiteNavigation = (content: SiteContent): SiteContent['navigation'] => {
  const knownSections = new Set(['#home', '#about', '#work', '#contact'])
  const navigation = records<SiteContent['navigation'][number]>(content.navigation)
    .filter(link => knownSections.has(link.href) && text(link.label))
    .filter((link, index, links) => links.findIndex(other => other.href === link.href) === index)
    .map(link => ({ label: text(link.label), href: link.href }))
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
  { id: 'home', title: text(content.intro), href: '#home', excerpt: text(content.tagline), text: `${text(content.name)} ${text(content.intro)} ${text(content.tagline)} Vermouth 像素肖像` },
  { id: 'about', title: '关于我', href: '#about', excerpt: strings(content.about)[0] ?? '', text: strings(content.about).join(' ') },
  ...getProjects(content).map(project => ({ id: project.id, title: project.title, href: `#project-${project.id}`, excerpt: project.subtitle,
    text: `${project.title} ${project.subtitle} ${project.description} ${project.tags.join(' ')} ${project.kind ?? ''} ${project.year ?? ''} ${(project.highlights ?? []).join(' ')} ${project.note ?? ''} ${project.status === 'active' ? '持续制作中' : '已归档'}` })),
  ...getInterests(content).map(interest => ({ id: `interest-${interest.id}`, title: interest.title, href: `#interest-${interest.id}`,
    excerpt: interest.description ?? '兴趣图鉴', text: `${interest.title} ${interest.description ?? ''} ${(interest.tags ?? []).join(' ')} ${(interest.favorites ?? []).join(' ')} ${interest.note ?? ''}` })),
  ...getGameProfiles(content).map(profile => ({ id: `game-${profile.id}`, title: profile.label, href: `#game-${profile.id}`,
    excerpt: profile.tagline ?? profile.description ?? '游戏基地', text: `${profile.label} ${profile.playerName ?? ''} ${profile.playerId ?? ''} ${profile.region ?? ''} ${profile.description ?? ''} ${profile.tagline ?? ''} ${(profile.tags ?? []).join(' ')} ${(profile.blocks ?? []).map(block => `${block.title} ${blockText(block)}`).join(' ')}` })),
  { id: 'contact', title: '社交坐标', href: '#contact', excerpt: text(content.email) || getSiteGithub(content) || '联系方式',
    text: getSocialLinks(content).map(profile => `${profile.label} ${profile.handle ?? ''} ${profile.description ?? ''}`).join(' ') },
]

/** Literal tokens only: queries never become regular expressions, HTML or requests. */
export const searchSite = (entries: SiteSearchEntry[], query: string): SiteSearchEntry[] => {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter(entry => tokens.every(token => `${entry.title} ${entry.text}`.toLocaleLowerCase().includes(token))).slice(0, 8)
}
