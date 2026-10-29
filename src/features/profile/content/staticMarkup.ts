import { getGameProfiles, getSiteNavigation, getSocialLinks, getTableOfContents, type SiteContent } from './site.ts'
import { pixelIconPaths, type PixelIconName } from './pixelIcons.ts'

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const escape = escapeHtml
const pixelIcon = (name: PixelIconName): string => `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${pixelIconPaths[name]}"></path></svg>`
const arrow = pixelIcon('arrow-up-right')
const heading = (id: string, symbol: string, title: string): string => `<div class="personal-section__label"><h2 id="${id}"><span aria-hidden="true">${symbol}</span> ${title}</h2></div>`

const renderGames = (site: SiteContent): string => {
  const profiles = getGameProfiles(site)
  if (!profiles.length) return ''
  return `<section class="personal-section" id="games" aria-labelledby="games-title" tabindex="-1">
    ${heading('games-title', '🎮', '遊戲足跡')}
    <div class="personal-games">${profiles.map((profile) => `<article class="personal-game">
      <div class="personal-game__heading"><span class="personal-game__icon">${pixelIcon('gamepad')}</span><h3>${escape(profile.label)}</h3></div>
      <dl class="personal-game__details">${profile.playerName ? `<div><dt>玩家</dt><dd>${escape(profile.playerName)}</dd></div>` : ''}${profile.playerId ? `<div><dt>ID</dt><dd>${escape(profile.playerId)}</dd></div>` : ''}${profile.region ? `<div><dt>區服</dt><dd>${escape(profile.region)}</dd></div>` : ''}</dl>
      ${profile.description ? `<p>${escape(profile.description)}</p>` : ''}
      ${profile.href ? `<a class="personal-text-link" href="${escape(profile.href)}" target="_blank" rel="noopener noreferrer">查看遊戲檔案 ${arrow}</a>` : ''}
    </article>`).join('')}</div>
  </section>`
}

/** Same document structure and confirmed content without JavaScript. Search is progressive enhancement. */
export const renderStaticSite = (site: SiteContent, base = '/'): string => {
  const navigation = getSiteNavigation(site)
  const contents = getTableOfContents(site)
  return `<div class="personal-site static-site" id="top">
  <a class="skip-link" href="#main-content">跳至主要內容</a>
  <header class="site-header">
    <div class="site-header__bar site-container">
      <a class="wordmark" href="#home" aria-label="${escape(site.name)}，回到首頁"><span class="wordmark__symbol" aria-hidden="true"><span></span></span><span>${escape(site.name)}<small>個人網站</small></span></a>
      <div class="site-header__tools"><a class="repository-link" href="${escape(`${site.github}/website`)}" target="_blank" rel="noopener noreferrer">${pixelIcon('github')}<span>GitHub Repository</span></a></div>
    </div>
    <nav class="site-header__nav site-container" aria-label="主要導覽">${navigation.map((item) => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join('')}</nav>
  </header>
  <div class="document-layout site-container">
    <aside class="site-sidebar" aria-label="網站導覽"><nav><a class="site-sidebar__home" href="#home">首頁</a>${navigation.filter((item) => item.href !== '#home').map((item) => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join('')}</nav><span class="site-sidebar__caption">${escape(site.intro)}</span></aside>
    <main class="document-main" id="main-content" tabindex="-1">
      <details class="mobile-contents"><summary>本頁目錄</summary><nav aria-label="行動版目錄">${contents.map((item) => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join('')}</nav></details>
      <section class="hero static-hero" id="home" aria-labelledby="hero-title" tabindex="-1">
        <div class="hero__copy"><p class="eyebrow">${escape(site.intro)}</p><h1 id="hero-title"><span aria-hidden="true">👋</span> 歡迎來到我的像素小世界</h1><p class="hero__intro">你好，我是 <strong>${escape(site.name)}</strong>。${escape(site.tagline)}</p></div>
        <figure class="hero__visual">
          <div class="hero-portrait hero-portrait--portrait"><div class="portrait-viewport" data-pixel-grid="256"><div class="portrait-viewport__art"><div class="portrait-fallback"><img src="${escape(`${base}portrait-rest.png`)}" width="768" height="768" fetchpriority="high" alt="Vermouth 的像素肖像：白金捲髮、冰藍眼睛與藍寶石飾物"></div></div></div></div>
          <figcaption><span>VERMOUTH</span><span>像素肖像 · 微風常在</span></figcaption>
        </figure>
        <aside class="welcome-note" aria-labelledby="welcome-note-title"><div class="welcome-note__title" id="welcome-note-title"><span aria-hidden="true">✦</span> 歡迎，隨意逛逛</div><p>這裡記錄我的作品與探索。你可以從下方了解我，瀏覽公開專案，或透過 GitHub 與 Email 聯絡我。</p></aside>
      </section>
      <section class="personal-section" id="about" aria-labelledby="about-title" tabindex="-1">
        ${heading('about-title', '📖', '關於我')}
        <div class="personal-about">${site.about.map((text, index) => `<p${index === 0 ? ' class="personal-about__lead"' : ''}>${escape(text)}</p>`).join('')}<a class="personal-text-link" href="${escape(site.github)}" target="_blank" rel="noopener noreferrer">了解我的 GitHub ${arrow}</a></div>
      </section>
      <section class="personal-section" id="work" aria-labelledby="work-title" tabindex="-1">
        ${heading('work-title', '🧩', '作品與實驗')}
        <div class="personal-work"><div class="personal-work__intro"><p>做過的，與正在做的。</p><a class="personal-text-link" href="${escape(`${site.github}?tab=repositories`)}" target="_blank" rel="noopener noreferrer">所有公開專案 ${arrow}</a></div>
          <div class="project-table-wrap"><table class="project-table"><caption class="visually-hidden">公開專案</caption><thead><tr><th scope="col">專案</th><th scope="col">狀態</th><th scope="col">說明</th></tr></thead><tbody>${site.projects.map((project) => `<tr class="personal-project" id="project-${escape(project.id)}" tabindex="-1">
            <td><a class="personal-project__link" href="${escape(project.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`${project.title} — ${project.subtitle}，開啟專案（另開分頁）`)}"><span class="personal-project__heading">${escape(project.title)} ${arrow}</span></a><span class="personal-project__subtitle">${escape(project.subtitle)}</span></td>
            <td><span class="personal-project__status personal-project__status--${project.status === 'active' ? 'active' : 'archived'}"><span aria-hidden="true"></span>${project.status === 'active' ? '持續製作中' : '已封存'}</span></td>
            <td><p class="personal-project__description">${escape(project.description)}</p><ul class="personal-project__tags" aria-label="專案技術">${project.tags.map((tag) => `<li>${escape(tag)}</li>`).join('')}</ul></td>
          </tr>`).join('')}</tbody></table></div>
          <blockquote class="document-note">每個作品都連結到真實的公開原始碼；已封存的專案保留當時的探索。</blockquote>
        </div>
      </section>
      ${renderGames(site)}
      <section class="personal-section personal-section--contact" id="contact" aria-labelledby="contact-title" tabindex="-1">
        ${heading('contact-title', '✉', '社群與聯絡')}
        <div class="personal-contact"><p class="personal-contact__description">關於作品、想法，或只是說聲你好，都歡迎來打個招呼。</p><div class="social-links">${getSocialLinks(site).map((profile) => `<a class="social-link" href="${escape(profile.href)}"${profile.platform === 'email' ? '' : ' target="_blank" rel="noopener noreferrer"'}><span class="social-link__icon">${pixelIcon(profile.platform)}</span><span class="social-link__copy"><span class="social-link__label">${escape(profile.label)}</span>${profile.handle ? `<span class="social-link__handle">${escape(profile.handle)}</span>` : ''}</span>${arrow}</a>`).join('')}</div></div>
      </section>
    </main>
    <aside class="site-toc" aria-labelledby="toc-title"><h2 id="toc-title">目錄</h2><nav aria-label="本頁目錄">${contents.map((item) => `<a href="${escape(item.href)}"><span aria-hidden="true">${item.symbol}</span>${escape(item.label)}</a>`).join('')}</nav><a class="site-toc__source" href="${escape(`${site.github}/website`)}" target="_blank" rel="noopener noreferrer">查看本站原始碼 ${arrow}</a></aside>
  </div>
  <footer class="site-footer site-container"><p>© ${new Date().getFullYear()} ${escape(site.fullName)}<span class="site-footer__note">一格一格，慢慢建造。</span></p><a href="#top">回到頂端 ↑</a><a href="${escape(site.github)}" target="_blank" rel="noopener noreferrer">GitHub ${arrow}</a></footer>
</div>`
}
