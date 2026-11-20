import { useMemo, type ReactNode } from 'react'
import PixelIcon from './PixelIcon'
import NavigationIcon from './NavigationIcon'
import SiteSearch from './SiteSearch'
import { useActiveSection } from '../hooks/useActiveSection'
import { usePageMotion } from '../hooks/usePageMotion'
import { getSiteGithub, getSiteRepository, getSiteNavigation, getTableOfContents, site } from '../content/site'

/** Shared document layout; profile content and the portrait rig evolve independently. */
export default function SiteShell({ children }: { children: ReactNode }) {
  const github = getSiteGithub(site)
  const repository = getSiteRepository(site)
  const { navigation, contents } = useMemo(() => ({
    navigation: getSiteNavigation(site),
    contents: getTableOfContents(site),
  }), [])
  const activeSection = useActiveSection(navigation)
  const { mode: pageMotion } = usePageMotion()

  const activeLink = (href: string) => href === `#${activeSection}`
  return (
    <div className="personal-site" id="top" data-active-section={activeSection} data-page-motion={pageMotion}>
      <a className="skip-link" href="#main-content">跳至主要内容</a>
      <header className="site-header">
        <div className="site-header__bar site-container">
          <a className="wordmark" href="#home" aria-label={`${site.name}，回到首页`}>
            <span className="wordmark__symbol" aria-hidden="true"><span className="grass-block" /></span>
            <span>{site.name}<small>个人网站</small></span>
          </a>
          <div className="site-header__tools">
            <SiteSearch />
            {repository ? <a className="repository-link" href={repository} target="_blank" rel="noopener noreferrer"><PixelIcon name="github" /><span>GitHub 仓库</span></a> : null}
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
          <h2 id="toc-title"><NavigationIcon href="#work" /><span>目录</span></h2>
          <nav aria-label="本页目录">{contents.map((link) => <a key={link.href} href={link.href} className={activeLink(link.href) ? 'is-active' : undefined} aria-current={activeLink(link.href) ? 'location' : undefined}><NavigationIcon href={link.href} /><span>{link.label}</span></a>)}</nav>
          {repository ? <a className="site-toc__source" href={repository} target="_blank" rel="noopener noreferrer">查看本站源码 <PixelIcon name="arrow-up-right" /></a> : null}
        </aside>
      </div>
      <footer className="site-footer site-container">
        <p>© {new Date().getFullYear()} {site.fullName}<span className="site-footer__note">一格一格，慢慢建造。</span></p>
        <a href="#top">回到顶部 ↑</a>
        {github ? <a href={github} target="_blank" rel="noopener noreferrer">GitHub <PixelIcon name="arrow-up-right" /></a> : null}
      </footer>
    </div>
  )
}
