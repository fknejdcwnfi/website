import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import PixelIcon from './PixelIcon'
import { getSiteNavigation, getSiteSearchEntries, getTableOfContents, searchSite, site } from '../content/site'

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
        <label className="visually-hidden" htmlFor="site-search">搜尋此網站</label>
        <svg className="site-search__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2"/><path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2"/></svg>
        <input ref={input} id="site-search" type="search" placeholder="搜尋此網站" autoComplete="off" maxLength={120} value={query} aria-expanded={expanded} aria-controls="site-search-results" onChange={(event) => { setQuery(event.target.value); setExpanded(true) }} onFocus={() => setExpanded(true)} />
        <kbd aria-hidden="true">/</kbd>
      </form>
      {expanded ? (
        <div className="site-search__results" id="site-search-results">
          <p className="site-search__summary" role="status">{query.trim() ? `找到 ${results.length} 個結果` : '搜尋介紹、作品與聯絡方式'}</p>
          {results.length ? <ul>{results.map((result) => <li key={result.id}><a href={result.href} onClick={() => {
            close()
            window.setTimeout(() => document.getElementById(result.href.slice(1))?.focus({ preventScroll: true }), 0)
          }}><span>{result.title}</span><small>{result.excerpt}</small></a></li>)}</ul> : <p className="site-search__empty">沒有相符內容，試試「Vermouth」、「Java」或「Email」。</p>}
        </div>
      ) : null}
    </div>
  )
}

/** Shared document layout; profile content and the portrait rig evolve independently. */
export default function SiteShell({ children }: { children: ReactNode }) {
  const navigation = getSiteNavigation(site)
  const contents = getTableOfContents(site)
  return (
    <div className="personal-site" id="top">
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <header className="site-header">
        <div className="site-header__bar site-container">
          <a className="wordmark" href="#home" aria-label={`${site.name}，回到首頁`}>
            <span className="wordmark__symbol" aria-hidden="true"><span /></span>
            <span>{site.name}<small>個人網站</small></span>
          </a>
          <div className="site-header__tools">
            <SiteSearch />
            <a className="repository-link" href={`${site.github}/website`} target="_blank" rel="noopener noreferrer"><PixelIcon name="github" /><span>GitHub Repository</span></a>
          </div>
        </div>
        <nav className="site-header__nav site-container" aria-label="主要導覽">
          {navigation.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
      </header>
      <div className="document-layout site-container">
        <aside className="site-sidebar" aria-label="網站導覽">
          <nav><a className="site-sidebar__home" href="#home">首頁</a>{navigation.filter((link) => link.href !== '#home').map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
          <span className="site-sidebar__caption">{site.intro}</span>
        </aside>
        <main className="document-main" id="main-content" tabIndex={-1}>
          <details className="mobile-contents"><summary>本頁目錄</summary><nav aria-label="行動版目錄">{contents.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav></details>
          {children}
        </main>
        <aside className="site-toc" aria-labelledby="toc-title">
          <h2 id="toc-title">目錄</h2>
          <nav aria-label="本頁目錄">{contents.map((link) => <a key={link.href} href={link.href}><span aria-hidden="true">{link.symbol}</span>{link.label}</a>)}</nav>
          <a className="site-toc__source" href={`${site.github}/website`} target="_blank" rel="noopener noreferrer">查看本站原始碼 <PixelIcon name="arrow-up-right" /></a>
        </aside>
      </div>
      <footer className="site-footer site-container">
        <p>© {new Date().getFullYear()} {site.fullName}<span className="site-footer__note">一格一格，慢慢建造。</span></p>
        <a href="#top">回到頂端 ↑</a>
        <a href={site.github} target="_blank" rel="noopener noreferrer">GitHub <PixelIcon name="arrow-up-right" /></a>
      </footer>
    </div>
  )
}
