import type { ReactNode } from 'react'
import { site } from '../content/site'

/** Shared personal-site layout. New sections/pages can reuse it without touching the portrait rig. */
export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="personal-site" id="top">
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <header className="site-header site-container">
        <a className="wordmark" href="#top" aria-label={`${site.name}，回到首頁`}>
          <span className="wordmark__symbol" aria-hidden="true">{site.name.slice(0, 1).toLowerCase()}</span>
          <span>{site.name}</span>
        </a>
        <nav aria-label="主要導覽">
          {site.navigation.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer site-container">
        <a href="#top">{site.name}<span aria-hidden="true">.</span></a>
        <p>© {new Date().getFullYear()} {site.fullName}</p>
        <a href={site.github} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  )
}
