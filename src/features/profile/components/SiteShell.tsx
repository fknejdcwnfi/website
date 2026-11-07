import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import PixelIcon from './PixelIcon'
import { getSiteNavigation, getSiteSearchEntries, getTableOfContents, searchSite, site } from '../content/site'
import { getNavigationIconPath } from '../content/navigationIcons'

function NavigationIcon({ href }: { href: string }) {
  return <svg className="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path fillRule="evenodd" d={getNavigationIconPath(href)} /></svg>
}

function SiteSearch() {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const results = searchSite(getSiteSearchEntries(site), query)
  const close = (): void => setExpanded(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (event.target instanceof Node && wrapper.current?.contains(event.target)) {
          event.preventDefault()
          input.current?.focus()
        }
        close()
      }
      const target = event.target as HTMLElement | null
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !target?.closest('input, textarea, [contenteditable="true"]')) {
        event.preventDefault()
        input.current?.focus()
      }
    }
    const onPointer = (event: PointerEvent): void => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  const jump = (event: FormEvent): void => {
    event.preventDefault()
    const first = results[0]
    if (!first) return
    const target = document.getElementById(first.href.slice(1))
    target?.scrollIntoView({ behavior: 'auto', block: 'start' })
    target?.focus({ preventScroll: true })
    window.history.replaceState(null, '', first.href)
    close()
    input.current?.blur()
  }

  return (
    <div className="site-search" ref={wrapper} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) close()
    }}>
      <form role="search" onSubmit={jump}>
        <label className="visually-hidden" htmlFor="site-search">搜索此网站</label>
        <svg className="site-search__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2"/><path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2"/></svg>
        <input ref={input} id="site-search" type="search" placeholder="搜索此网站" autoComplete="off" maxLength={120} value={query} aria-expanded={expanded} aria-controls="site-search-results" onChange={(event) => { setQuery(event.target.value); setExpanded(true) }} onFocus={() => setExpanded(true)} />
        <kbd aria-hidden="true">/</kbd>
      </form>
      {expanded ? (
        <div className="site-search__results" id="site-search-results">
          <p className="site-search__summary" role="status">{query.trim() ? `找到 ${results.length} 个结果` : '搜索作品、兴趣、游戏与联系方式'}</p>
          {results.length ? <ul>{results.map((result) => <li key={result.id}><a href={result.href} onClick={() => {
            close()
            window.setTimeout(() => document.getElementById(result.href.slice(1))?.focus({ preventScroll: true }), 0)
          }}><span>{result.title}</span><small>{result.excerpt}</small></a></li>)}</ul> : <p className="site-search__empty">没有匹配内容，试试「火影」「柯南」或「王者荣耀」。</p>}
        </div>
      ) : null}
    </div>
  )
}

/** Shared document layout; profile content and the portrait rig evolve independently. */
export default function SiteShell({ children }: { children: ReactNode }) {
  const navigation = getSiteNavigation(site)
  const contents = getTableOfContents(site)
  const [activeSection, setActiveSection] = useState('home')

  useEffect(() => {
    const sections = navigation.map(link => document.getElementById(link.href.slice(1))).filter((section): section is HTMLElement => section !== null)
    let frame = 0
    const update = (): void => {
      frame = 0
      const header = document.querySelector('.site-header')?.getBoundingClientRect()
      const marker = Math.max(48, Math.min(window.innerHeight * .3, (header?.bottom ?? 0) + 48))
      let active = sections[0]?.id ?? 'home'
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) active = section.id
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) active = sections[sections.length - 1]?.id ?? active
      setActiveSection(active)
    }
    const schedule = (): void => { if (!frame) frame = window.requestAnimationFrame(update) }
    const hashChanged = (): void => {
      const target = document.getElementById(window.location.hash.slice(1))
      const section = target?.closest('main > section')
      if (section) setActiveSection(section.id)
      schedule()
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('hashchange', hashChanged)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('hashchange', hashChanged)
    }
  }, [])

  const activeLink = (href: string) => href === `#${activeSection}`
  return (
    <div className="personal-site" id="top" data-active-section={activeSection}>
      <a className="skip-link" href="#main-content">跳至主要内容</a>
      <header className="site-header">
        <div className="site-header__bar site-container">
          <a className="wordmark" href="#home" aria-label={`${site.name}，回到首页`}>
            <span className="wordmark__symbol" aria-hidden="true"><span className="grass-block" /></span>
            <span>{site.name}<small>个人网站</small></span>
          </a>
          <div className="site-header__tools">
            <SiteSearch />
            <a className="repository-link" href={`${site.github}/website`} target="_blank" rel="noopener noreferrer"><PixelIcon name="github" /><span>GitHub 仓库</span></a>
          </div>
        </div>
        <nav className="site-header__nav site-container" aria-label="主要导航">
          {navigation.map((link) => <a key={link.href} href={link.href} className={activeLink(link.href) ? 'is-active' : undefined} aria-current={activeLink(link.href) ? 'location' : undefined}><NavigationIcon href={link.href} /><span>{link.label}</span></a>)}
        </nav>
      </header>
      <div className="document-layout site-container">
        <aside className="site-sidebar" aria-label="网站导航">
          <span className="pixel-lantern pixel-lantern--sidebar" aria-hidden="true" />
          <nav>{navigation.map((link) => <a key={link.href} href={link.href} className={`${link.href === '#home' ? 'site-sidebar__home ' : ''}${activeLink(link.href) ? 'is-active' : ''}`.trim() || undefined} aria-current={activeLink(link.href) ? 'location' : undefined}><NavigationIcon href={link.href} /><span>{link.label}</span></a>)}</nav>
          <span className="site-sidebar__caption"><span className="grass-block" aria-hidden="true" />{site.intro}</span>
        </aside>
        <main className="document-main" id="main-content" tabIndex={-1}>
          <details className="mobile-contents"><summary>本页目录</summary><nav aria-label="手机版目录">{contents.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav></details>
          {children}
        </main>
        <aside className="site-toc" aria-labelledby="toc-title">
          <span className="pixel-lantern pixel-lantern--toc" aria-hidden="true" />
          <h2 id="toc-title"><span aria-hidden="true">📖</span> 目录</h2>
          <nav aria-label="本页目录">{contents.map((link) => <a key={link.href} href={link.href} className={activeLink(link.href) ? 'is-active' : undefined} aria-current={activeLink(link.href) ? 'location' : undefined}><span aria-hidden="true">{link.symbol}</span><span>{link.label}</span></a>)}</nav>
          <a className="site-toc__source" href={`${site.github}/website`} target="_blank" rel="noopener noreferrer">查看本站源码 <PixelIcon name="arrow-up-right" /></a>
        </aside>
      </div>
      <footer className="site-footer site-container">
        <p>© {new Date().getFullYear()} {site.fullName}<span className="site-footer__note">一格一格，慢慢建造。</span></p>
        <a href="#top">回到顶部 ↑</a>
        <a href={site.github} target="_blank" rel="noopener noreferrer">GitHub <PixelIcon name="arrow-up-right" /></a>
      </footer>
    </div>
  )
}
