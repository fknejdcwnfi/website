import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import PixelIcon from './PixelIcon'
import NavigationIcon from './NavigationIcon'
import { getSiteSearchEntries, site } from '../content/site'
import { createSearchIndex, searchIndex, type SiteSearchIndex } from '../content/searchIndex'

export default function SiteSearch() {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [index, setIndex] = useState<SiteSearchIndex | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const imeSubmit = useRef(false)
  const imeTimer = useRef<number | undefined>(undefined)
  const isImeKey = (event: KeyboardEvent): boolean => composing.current || event.isComposing || event.keyCode === 229
  const matches = useMemo(() => expanded && index ? searchIndex(index, query) : [], [expanded, index, query])
  const describeGroup = (href: string) => {
    if (href.startsWith('#note-') || href.startsWith('#thought-')) return { id: 'writing', label: '思绪与日志', icon: '#writing' }
    if (href.startsWith('#project-')) return { id: 'work', label: '作品', icon: '#work' }
    if (href.startsWith('#interest-')) return { id: 'interests', label: '兴趣', icon: '#interests' }
    if (href.startsWith('#game-')) return { id: 'games', label: '游戏', icon: '#games' }
    if (href.startsWith('#contact-')) return { id: 'contact', label: '联系方式', icon: '#contact' }
    return { id: 'pages', label: '页面导航', icon: '#home' }
  }
  const groups: { id: string; label: string; icon: string; items: typeof matches }[] = []
  for (const result of matches) {
    const category = describeGroup(result.href)
    const group = groups.find(item => item.id === category.id)
    if (group) group.items.push(result)
    else groups.push({ ...category, items: [result] })
  }
  const results = groups.flatMap(group => group.items)
  const open = (): void => {
    setIndex(current => current ?? createSearchIndex(getSiteSearchEntries(site)))
    setExpanded(true)
  }
  const close = (): void => setExpanded(false)
  const focusResult = (index: number): void => {
    const links = wrapper.current?.querySelectorAll<HTMLAnchorElement>('.site-search__result')
    if (!links?.length) return
    links[(index + links.length) % links.length]?.focus()
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (isImeKey(event)) return
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
      window.clearTimeout(imeTimer.current)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  const jump = (event: FormEvent): void => {
    event.preventDefault()
    if (composing.current || imeSubmit.current) return
    const first = results[0]
    if (!first) return
    const target = document.getElementById(first.href.slice(1))
    target?.scrollIntoView({ behavior: 'auto', block: 'start' })
    target?.focus({ preventScroll: true })
    window.history.replaceState(null, '', first.href)
    window.dispatchEvent(new CustomEvent('site:navigate', { detail: first.href }))
    close()
    input.current?.blur()
  }

  return (
    <div className="site-search" ref={wrapper} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) close()
    }}>
      <form role="search" onSubmit={jump}>
        <label className="visually-hidden" htmlFor="site-search">搜索此网站</label>
        <svg className="site-search__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" shapeRendering="crispEdges"><path fillRule="evenodd" d="M3 1h6v1h2v2h1v5h-1v2h-1v1h2v1h1v1h2v2h-3v-1h-1v-1h-1v-2H4v-1H2V9H1V4h1V2h1V1zm1 2v1H3v5h1v1h5V9h1V4H9V3H4z" /></svg>
        <input ref={input} id="site-search" type="search" placeholder="搜索此网站" autoComplete="off" maxLength={120} value={query} aria-expanded={expanded} aria-controls="site-search-results"
          onChange={(event) => { setQuery(event.target.value); open() }} onFocus={open} onClick={open}
          onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
          onKeyDown={(event) => {
            if (isImeKey(event.nativeEvent)) {
              // Let the IME consume its own keys. A composition-commit Enter
              // may still submit the form after compositionend (notably 229).
              imeSubmit.current = true
              window.clearTimeout(imeTimer.current)
              imeTimer.current = window.setTimeout(() => { imeSubmit.current = false; imeTimer.current = undefined }, 0)
              return
            }
            imeSubmit.current = false
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              open()
              const last = event.key === 'ArrowUp'
              window.requestAnimationFrame(() => focusResult(last ? -1 : 0))
            }
          }} />
        <kbd aria-hidden="true">/</kbd>
      </form>
      {expanded ? (
        <div className="site-search__results" id="site-search-results">
          <div className="site-search__summary"><span role="status">{query.trim() ? `找到 ${results.length} 个结果` : '快速跳转'}</span><span className="site-search__count" aria-hidden="true">{results.length}</span></div>
          {results.length ? <div className="site-search__list">{groups.map(group => <section className="site-search__group" key={group.id} aria-labelledby={`search-group-${group.id}`}>
            <h3 className="site-search__group-label" id={`search-group-${group.id}`}>{group.label}</h3>
            <ul>{group.items.map(result => <li key={result.id}><a className="site-search__result" href={result.href}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
                event.preventDefault()
                const links = [...(wrapper.current?.querySelectorAll<HTMLAnchorElement>('.site-search__result') ?? [])]
                focusResult(links.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1))
              }}
              onClick={() => {
                close()
                window.setTimeout(() => document.getElementById(result.href.slice(1))?.focus({ preventScroll: true }), 0)
              }}><span className="site-search__result-icon"><NavigationIcon href={group.icon} /></span><span className="site-search__result-copy"><span>{result.title}</span><small>{result.excerpt}</small></span><PixelIcon name="arrow-up-right" /></a></li>)}</ul>
          </section>)}</div> : <p className="site-search__empty">没有匹配内容，试试「火影」「柯南」或「王者荣耀」。</p>}
          <div className="site-search__help" aria-hidden="true"><span>↑↓ 切换</span><span>Enter 前往</span><span>Esc 收起</span></div>
        </div>
      ) : null}
    </div>
  )
}
