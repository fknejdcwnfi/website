import type { ReactNode } from 'react'
import { getSiteNavigation, site } from '../content/site'

/** Shared personal-site layout. New sections/pages can reuse it without touching the portrait rig. */
export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="personal-site" id="top">
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <header className="site-header site-container">
        <a className="wordmark" href="#top" aria-label={`${site.name}，回到首頁`}>
          <span className="wordmark__symbol" aria-hidden="true"><span /></span>
          <span>{site.name}</span>
        </a>
        <nav aria-label="主要導覽">
          {getSiteNavigation(site).map((link, index) => <a key={link.href} href={link.href}><span className="site-nav__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{link.label}</a>)}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer site-container">
        <a href="#top">{site.name}<span aria-hidden="true">.</span></a>
        <p>© {new Date().getFullYear()} {site.fullName}<span className="site-footer__note">一格一格，慢慢建造。</span></p>
        <a href={site.github} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  )
}
