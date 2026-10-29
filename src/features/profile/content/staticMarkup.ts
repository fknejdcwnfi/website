import { getGameProfiles, getSiteNavigation, getSocialLinks, type SiteContent } from './site.ts'
import { pixelIconPaths, type PixelIconName } from './pixelIcons.ts'

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const escape = escapeHtml

const pixelIcon = (name: PixelIconName): string => `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${pixelIconPaths[name]}"></path></svg>`

const arrow = pixelIcon('arrow-up-right')

const sectionLabel = (index: string, english: string, title: string, id: string): string => `
  <div class="personal-section__label">
    <span class="personal-section__index">${index} / ${english}</span>
    <h2 id="${id}">${title}</h2>
  </div>`

const renderGames = (site: SiteContent): string => {
  const profiles = getGameProfiles(site)
  if (!profiles.length) return ''
  return `<section class="personal-section site-container" id="games" aria-labelledby="games-title">
    ${sectionLabel('03', 'GAME PROFILES', '遊戲足跡', 'games-title')}
    <div class="personal-games">${profiles.map((profile) => `
      <article class="personal-game">
        <div class="personal-game__heading"><span class="personal-game__icon">${pixelIcon('gamepad')}</span><h3>${escape(profile.label)}</h3></div>
        <dl class="personal-game__details">${profile.playerName ? `<div><dt>玩家</dt><dd>${escape(profile.playerName)}</dd></div>` : ''}${profile.playerId ? `<div><dt>ID</dt><dd>${escape(profile.playerId)}</dd></div>` : ''}${profile.region ? `<div><dt>區服</dt><dd>${escape(profile.region)}</dd></div>` : ''}</dl>
        ${profile.description ? `<p>${escape(profile.description)}</p>` : ''}
        ${profile.href ? `<a class="personal-text-link" href="${escape(profile.href)}" target="_blank" rel="noopener noreferrer">查看遊戲檔案 ${arrow}</a>` : ''}
      </article>`).join('')}</div>
  </section>`
}

/** Initial HTML shares the homepage's semantic structure and CSS, including without JavaScript. */
export const renderStaticSite = (site: SiteContent, base = '/'): string => `
<div class="personal-site static-site" id="top">
  <a class="skip-link" href="#main-content">跳至主要內容</a>
  <header class="site-header site-container">
    <a class="wordmark" href="#top" aria-label="${escape(site.name)}，回到首頁">
      <span class="wordmark__symbol" aria-hidden="true"><span></span></span>
      <span>${escape(site.name)}</span>
    </a>
    <nav aria-label="主要導覽">${getSiteNavigation(site).map((item, index) => `<a href="${escape(item.href)}"><span class="site-nav__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${escape(item.label)}</a>`).join('')}</nav>
  </header>
  <main id="main-content" tabindex="-1">
    <section class="hero site-container static-hero" aria-labelledby="hero-title">
      <figure class="hero__visual">
        <div class="hero-portrait hero-portrait--portrait">
          <div class="portrait-viewport" data-pixel-grid="256">
            <div class="portrait-viewport__art">
              <div class="portrait-fallback"><img src="${escape(`${base}portrait-rest.png`)}" width="768" height="768" fetchpriority="high" alt="Vermouth 的像素肖像：白金捲髮、冰藍眼睛與藍寶石飾物"></div>
            </div>
          </div>
        </div>
        <figcaption><span>VERMOUTH</span><span>像素肖像 · 微風常在</span></figcaption>
      </figure>
      <div class="hero__copy">
        <p class="eyebrow"><span class="small-spark" aria-hidden="true"></span> ${escape(site.intro)}</p>
        <h1 id="hero-title"><span class="hero__greeting">你好，我是</span><span class="hero__name" lang="en">${escape(site.name)}<span class="hero__dot">.</span></span></h1>
        <p class="hero__intro">${escape(site.tagline)}</p>
        <div class="hero__actions">
          <a class="button-primary" href="#work">看看我的作品 ${pixelIcon('arrow-down')}</a>
          <a class="text-link" href="${escape(site.github)}" target="_blank" rel="noopener noreferrer">在 GitHub 找我 ${arrow}</a>
        </div>
      </div>
    </section>
    <section class="personal-section site-container" id="about" aria-labelledby="about-title">
      ${sectionLabel('01', 'ABOUT', '關於我', 'about-title')}
      <div class="personal-about">
        ${site.about.map((text, index) => `<p${index === 0 ? ' class="personal-about__lead"' : ''}>${escape(text)}</p>`).join('')}
        <a class="personal-text-link" href="${escape(site.github)}" target="_blank" rel="noopener noreferrer">了解我的 GitHub ${arrow}</a>
      </div>
    </section>
    <section class="personal-section site-container" id="work" aria-labelledby="work-title">
      ${sectionLabel('02', 'SELECTED WORK', '作品與實驗', 'work-title')}
      <div class="personal-work">
        <div class="personal-work__intro"><p>做過的，與正在做的。</p><a class="personal-text-link" href="${escape(`${site.github}?tab=repositories`)}" target="_blank" rel="noopener noreferrer">所有公開專案 ${arrow}</a></div>
        <div class="personal-projects">${site.projects.map((project, index) => `
          <article class="personal-project">
            <a class="personal-project__link" href="${escape(project.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`${project.title} — ${project.subtitle}，開啟專案（另開分頁）`)}">
              <div class="personal-project__top"><span class="personal-project__slot" aria-hidden="true">${pixelIcon(project.id === 'xiangqi-review' ? 'chess' : 'code')}</span><span class="personal-project__status personal-project__status--${project.status === 'active' ? 'active' : 'archived'}"><span aria-hidden="true"></span>${project.status === 'active' ? '持續製作中' : '已封存'}</span></div>
              <span class="personal-project__number">PROJECT / ${String(index + 1).padStart(2, '0')}</span>
              <div class="personal-project__heading"><h3>${escape(project.title)}</h3>${arrow}</div>
              <p class="personal-project__subtitle">${escape(project.subtitle)}</p>
              <p class="personal-project__description">${escape(project.description)}</p>
              <ul class="personal-project__tags" aria-label="專案技術">${project.tags.map((tag) => `<li>${escape(tag)}</li>`).join('')}</ul>
            </a>
          </article>`).join('')}
        </div>
      </div>
    </section>
    ${renderGames(site)}
    <section class="personal-section personal-section--contact site-container" id="contact" aria-labelledby="contact-title">
      ${sectionLabel(getGameProfiles(site).length ? '04' : '03', 'GET IN TOUCH', '社群與聯絡', 'contact-title')}
      <div class="personal-contact">
        <p class="personal-contact__heading">有想聊的？<br>來打個招呼。</p>
        <p class="personal-contact__description">關於作品、想法，或只是說聲你好。</p>
        <div class="social-links">
          ${getSocialLinks(site).map((profile) => `<a class="social-link" href="${escape(profile.href)}"${profile.platform === 'email' ? '' : ' target="_blank" rel="noopener noreferrer"'}><span class="social-link__icon">${pixelIcon(profile.platform)}</span><span class="social-link__copy"><span class="social-link__label">${escape(profile.label)}</span>${profile.handle ? `<span class="social-link__handle">${escape(profile.handle)}</span>` : ''}</span>${arrow}</a>`).join('')}
        </div>
        <span class="personal-contact__handle">@${escape(site.handle)}</span>
      </div>
    </section>
  </main>
  <footer class="site-footer site-container">
    <a href="#top">${escape(site.name)}<span aria-hidden="true">.</span></a>
    <p>© ${new Date().getFullYear()} ${escape(site.fullName)}<span class="site-footer__note">一格一格，慢慢建造。</span></p>
    <a href="${escape(site.github)}" target="_blank" rel="noopener noreferrer">GitHub ${arrow}</a>
  </footer>
</div>`
