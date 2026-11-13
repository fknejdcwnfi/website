import { getGameProfiles, getInterests, getProjects, getSiteGithub, getSiteRepository, getSiteNavigation, getSocialLinks, getTableOfContents, resolveProfileAsset, type GameShowcaseBlock, type SiteContent } from './site.ts'
import { pixelIconPaths, type PixelIconName } from './pixelIcons.ts'
import { poeticPixelAssets } from '../../poeticPixel/assets.ts'
import { renderPoeticEntryAtmosphere } from '../../poeticPixel/bootstrap.ts'
import { renderNavigationIcon } from './navigationIcons.ts'
import { GAME_DECORATION, getInterestDecoration, getSocialDecoration } from './decorativeAssets.ts'

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const escape = escapeHtml
const pixelIcon = (name: PixelIconName): string => `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${pixelIconPaths[name]}"></path></svg>`
const arrow = pixelIcon('arrow-up-right')
const heading = (id: string, href: string, title: string): string => `<div class="personal-section__label"><h2 id="${id}"><span aria-hidden="true">${renderNavigationIcon(href)}</span> ${title}</h2></div>`

const sectionHeading = (id: string, icon: PixelIconName, title: string): string => `<div class="personal-section__label"><h2 id="${id}"><span aria-hidden="true">${pixelIcon(icon)}</span> ${title}</h2></div>`
const tags = (items: string[] | undefined, className: string, label: string): string => items?.length
  ? `<ul class="${className}" aria-label="${escape(label)}">${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : ''
const categoryNames = { anime: '动漫', manga: '漫画', music: '音乐', other: '兴趣' } as const

const renderInterests = (site: SiteContent, base: string): string => {
  const interests = getInterests(site)
  if (!interests.length) return ''
  return `<section class="personal-section" id="interests" aria-labelledby="interests-title" tabindex="-1">
    ${sectionHeading('interests-title', 'heart', '兴趣图鉴')}
    <p class="profile-section__intro">喜欢的故事，值得留一格。</p>
    <div class="interest-grid">${interests.map(interest => {
      const cover = resolveProfileAsset(interest.cover, base)
      const decoration = getInterestDecoration(interest.id)
      return `<article class="interest-card" data-category="${interest.category}" id="interest-${escape(interest.id)}" tabindex="-1">
        ${cover ? `<img class="interest-card__cover" src="${escape(cover)}" width="640" height="360" loading="lazy" decoding="async" alt="${escape(interest.title)}封面">` : `<div class="interest-card__scene" data-interest="${escape(interest.id)}" aria-hidden="true">${decoration ? `<img class="interest-card__image" src="${escape(`${base}assets/pixel-ui/${decoration.file}`)}" width="${decoration.width}" height="${decoration.height}" loading="lazy" decoding="async" alt="" aria-hidden="true">` : ''}</div>`}
        <div class="interest-card__heading"><span class="interest-card__icon">${pixelIcon('heart')}</span><div><p class="interest-card__category">${categoryNames[interest.category]}</p><h3>${escape(interest.title)}</h3></div></div>
        ${interest.description ? `<p>${escape(interest.description)}</p>` : ''}
        ${tags(interest.tags, 'interest-card__tags', `${interest.title}标签`)}
        ${interest.favorites?.length ? `<div class="interest-card__favorites"><h4>特别喜欢</h4><ul>${interest.favorites.map(item => `<li>${escape(item)}</li>`).join('')}</ul></div>` : ''}
        ${interest.note ? `<p class="interest-card__note">${escape(interest.note)}</p>` : ''}
        ${interest.href ? `<a class="personal-text-link" href="${escape(interest.href)}" target="_blank" rel="noopener noreferrer">了解更多 ${arrow}</a>` : ''}
      </article>`
    }).join('')}</div>
  </section>`
}

const renderShowcaseBlock = (block: GameShowcaseBlock, base: string): string => {
  let body: string
  switch (block.kind) {
    case 'facts': body = `<dl class="showcase-facts">${block.items.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>`; break
    case 'collection': body = `<ul class="showcase-collection">${block.items.map(item => `<li><strong>${escape(item.name)}</strong>${item.note ? `<p>${escape(item.note)}</p>` : ''}</li>`).join('')}</ul>`; break
    case 'notes': body = `<p class="showcase-note">${escape(block.text)}</p>`; break
    case 'gallery': body = `<div class="showcase-gallery">${block.items.map(item => {
      const src = resolveProfileAsset(item.src, base)
      if (!src) return ''
      const image = `<img src="${escape(src)}" alt="${escape(item.title)}" width="640" height="360" loading="lazy" decoding="async">`
      return `<figure>${item.href ? `<a href="${escape(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(item.title)}（在新标签页打开）">${image}</a>` : image}<figcaption><strong>${escape(item.title)}</strong>${item.description ? `<span>${escape(item.description)}</span>` : ''}</figcaption></figure>`
    }).join('')}</div>`; break
    case 'links': body = `<ul class="showcase-links">${block.items.map(item => `<li><a class="personal-text-link" href="${escape(item.href)}" target="_blank" rel="noopener noreferrer">${escape(item.title)} ${arrow}</a>${item.description ? `<p>${escape(item.description)}</p>` : ''}</li>`).join('')}</ul>`; break
  }
  return `<details class="showcase-block"${block.expanded === true ? ' open' : ''}><summary><span>${escape(block.title)}</span>${pixelIcon('arrow-down')}</summary><div class="showcase-block__body">${body}</div></details>`
}

const renderGames = (site: SiteContent, base: string): string => {
  const profiles = getGameProfiles(site)
  if (!profiles.length) return ''
  return `<section class="personal-section" id="games" aria-labelledby="games-title" tabindex="-1">
    ${sectionHeading('games-title', 'gamepad', '游戏基地')}
    <p class="profile-section__intro">在喜欢的世界里，留下自己的足迹。</p>
    <div class="personal-games">${profiles.map(profile => {
      const cover = resolveProfileAsset(profile.cover, base)
      return `<article class="game-showcase" data-game="${escape(profile.game)}" id="game-${escape(profile.id)}" tabindex="-1">
        ${cover ? `<img class="game-showcase__cover" src="${escape(cover)}" alt="${escape(profile.label)}封面" width="640" height="360" loading="lazy" decoding="async">` : `<div class="game-showcase__scene" aria-hidden="true"><img class="game-showcase__image" src="${escape(`${base}assets/pixel-ui/${GAME_DECORATION.file}`)}" width="${GAME_DECORATION.width}" height="${GAME_DECORATION.height}" loading="lazy" decoding="async" alt="" aria-hidden="true"></div>`}
        <div class="game-showcase__header"><span class="game-showcase__icon">${pixelIcon('gamepad')}</span><div>${profile.tagline ? `<p class="game-showcase__tagline">${escape(profile.tagline)}</p>` : ''}<h3>${escape(profile.label)}</h3></div></div>
        ${profile.description ? `<p>${escape(profile.description)}</p>` : ''}
        ${tags(profile.tags, 'game-showcase__tags', `${profile.label}标签`)}
        ${profile.playerName || profile.playerId || profile.region ? `<dl class="game-showcase__details">${profile.playerName ? `<div><dt>玩家</dt><dd>${escape(profile.playerName)}</dd></div>` : ''}${profile.playerId ? `<div><dt>ID</dt><dd>${escape(profile.playerId)}</dd></div>` : ''}${profile.region ? `<div><dt>区服</dt><dd>${escape(profile.region)}</dd></div>` : ''}</dl>` : ''}
        ${profile.blocks?.length ? `<div class="game-showcase__blocks">${profile.blocks.map(block => renderShowcaseBlock(block, base)).join('')}</div>` : ''}
        ${profile.href ? `<a class="personal-text-link" href="${escape(profile.href)}" target="_blank" rel="noopener noreferrer">查看游戏主页 ${arrow}</a>` : ''}
      </article>`
    }).join('')}</div>
  </section>`
}

const renderSocials = (site: SiteContent, base: string): string => `<section class="personal-section personal-section--contact" id="contact" aria-labelledby="contact-title" tabindex="-1">
  ${sectionHeading('contact-title', 'other', '社交坐标')}
  <div class="personal-contact"><p class="personal-contact__description">关于作品、兴趣，或者只是说声你好，都欢迎来打个招呼。</p><div class="social-cards">${getSocialLinks(site).map(profile => {
    const qrCode = resolveProfileAsset(profile.qrCode, base)
    const decoration = getSocialDecoration(profile.platform)
    return `<article class="social-card" data-platform="${profile.platform}" id="contact-${escape(profile.id)}" tabindex="-1">
      ${decoration ? `<img class="social-card__scene" src="${escape(`${base}assets/pixel-ui/${decoration.file}`)}" width="${decoration.width}" height="${decoration.height}" loading="lazy" decoding="async" alt="" aria-hidden="true">` : ''}
      <div class="social-card__heading"><span class="social-card__icon">${pixelIcon(profile.platform)}</span><h3 class="social-card__label">${escape(profile.label)}</h3></div>
      ${profile.handle ? `<p class="social-card__handle" id="account-${escape(profile.id)}">${escape(profile.handle)}</p>` : ''}
      ${profile.description ? `<p class="social-card__description">${escape(profile.description)}</p>` : ''}
      ${profile.href ? `<div class="social-card__actions"><a class="personal-text-link" href="${escape(profile.href)}"${profile.platform === 'email' ? '' : ' target="_blank" rel="noopener noreferrer"'}>${profile.platform === 'email' ? '发送邮件' : '打开主页'} ${arrow}</a></div>` : ''}
      ${qrCode ? `<details class="social-qr"><summary>查看${escape(profile.label)}二维码</summary><img src="${escape(qrCode)}" alt="${escape(profile.label)}联系二维码" width="240" height="240" loading="lazy" decoding="async"></details>` : ''}
    </article>`
  }).join('')}</div></div>
</section>`

/** Same document structure and confirmed content without JavaScript. Search is progressive enhancement. */
export const renderStaticSite = (site: SiteContent, base = '/'): string => {
  const github = getSiteGithub(site)
  const repository = getSiteRepository(site)
  const navigation = getSiteNavigation(site)
  const contents = getTableOfContents(site)
  const projects = getProjects(site)
  const projectOverview = [
    { label: '公开项目', count: projects.length },
    { label: '持续制作', count: projects.filter(project => project.status === 'active').length },
    { label: '已归档', count: projects.filter(project => project.status === 'archived').length },
  ]
  return `<div class="personal-site static-site" id="top" data-active-section="home">
  <a class="skip-link" href="#main-content">跳至主要内容</a>
  <header class="site-header">
    <div class="site-header__bar site-container">
      <a class="wordmark" href="#home" aria-label="${escape(site.name)}，回到首页"><span class="wordmark__symbol" aria-hidden="true"><span class="grass-block"></span></span><span>${escape(site.name)}<small>个人网站</small></span></a>
      <div class="site-header__tools">${repository ? `<a class="repository-link" href="${escape(repository)}" target="_blank" rel="noopener noreferrer">${pixelIcon('github')}<span>GitHub 仓库</span></a>` : ''}</div>
    </div>
    <nav class="site-header__nav site-container" aria-label="主导航">${navigation.map((item) => `<a href="${escape(item.href)}"${item.href === '#home' ? ' class="is-active" aria-current="location"' : ''}>${renderNavigationIcon(item.href)}<span>${escape(item.label)}</span></a>`).join('')}</nav>
  </header>
  <div class="document-layout site-container">
    <aside class="site-sidebar" aria-label="网站导航"><span class="pixel-lantern pixel-lantern--sidebar" aria-hidden="true"></span><nav>${navigation.map((item) => `<a href="${escape(item.href)}"${item.href === '#home' ? ' class="site-sidebar__home is-active" aria-current="location"' : ''}>${renderNavigationIcon(item.href)}<span>${escape(item.label)}</span></a>`).join('')}</nav><span class="site-sidebar__caption"><span class="grass-block" aria-hidden="true"></span>${escape(site.intro)}</span></aside>
    <main class="document-main" id="main-content" tabindex="-1">
      <details class="mobile-contents"><summary>本页目录</summary><nav aria-label="移动端目录">${contents.map((item) => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join('')}</nav></details>
      <section class="hero static-hero" id="home" aria-labelledby="hero-title" tabindex="-1">
        <div class="hero__copy"><p class="eyebrow">${escape(site.intro)}</p><h1 id="hero-title"><span class="hero__wave" aria-hidden="true">${renderNavigationIcon('#interests')}</span> 欢迎来到我的<strong class="hero__highlight">像素小世界</strong></h1><p class="hero__intro">你好，我是 <strong>${escape(site.name)}</strong>。${escape(site.tagline)}</p></div>
        <figure class="hero__visual hero__visual--reference">
          <div class="reference-scene-static"><div class="reference-scene__space"><div class="reference-scene__viewport">
            <img class="reference-scene__poster" src="${escape(`${base}assets/poetic-pixel/canonical.png?v=${poeticPixelAssets.canonicalSha256}`)}" width="${poeticPixelAssets.canonicalWidth}" height="${poeticPixelAssets.canonicalHeight}" fetchpriority="high" alt="Vermouth的高清像素圆形肖像，保留樱花、富士山与夕阳">
            <div class="reference-scene__preview" data-active="true" aria-hidden="true"><div id="vermouth-poetic-entry" class="poetic-entry-group" data-weather="hidden" data-motion="paused"><video id="vermouth-poetic-bootstrap" class="poetic-scene__boot" data-src="${escape(`${base}assets/poetic-pixel/${poeticPixelAssets.boot.file}?v=${poeticPixelAssets.boot.sha256}`)}" width="${poeticPixelAssets.boot.width}" height="${poeticPixelAssets.boot.height}" muted autoplay loop playsinline preload="auto" aria-hidden="true"></video>${renderPoeticEntryAtmosphere()}</div></div>
          </div></div></div>
          <figcaption><span>VERMOUTH</span><span>Minecraft · 像素肖像</span></figcaption>
        </figure>
        <aside class="welcome-note" aria-labelledby="welcome-note-title"><div class="welcome-note__title" id="welcome-note-title"><span aria-hidden="true">${renderNavigationIcon('#interests')}</span> 欢迎，随意逛逛</div><p>这里记录我的作品、兴趣和游戏内容。你可以从下方了解我，浏览公开项目，或通过社交账号打个招呼。</p></aside>
      </section>
      <section class="personal-section" id="about" aria-labelledby="about-title" tabindex="-1">
        ${heading('about-title', '#about', '关于我')}
        <div class="personal-about"><div class="personal-about__scene" aria-hidden="true"></div>${site.about.map((text, index) => `<p${index === 0 ? ' class="personal-about__lead"' : ''}>${escape(text)}</p>`).join('')}${github ? `<a class="personal-text-link" href="${escape(github)}" target="_blank" rel="noopener noreferrer">了解我的 GitHub ${arrow}</a>` : ''}</div>
      </section>
      <section class="personal-section" id="work" aria-labelledby="work-title" tabindex="-1">
        ${heading('work-title', '#work', '作品与实验')}
        <div class="personal-work"><div class="personal-work__intro"><p>做过的，与正在做的。</p>${github ? `<a class="personal-text-link" href="${escape(`${github}?tab=repositories`)}" target="_blank" rel="noopener noreferrer">所有公开项目 ${arrow}</a>` : ''}</div>
          <dl class="project-overview" aria-label="项目概览">${projectOverview.map(item => `<div><dt>${item.label}</dt><dd>${item.count}<span> 个</span></dd></div>`).join('')}</dl>
          <div class="project-table-wrap"><table class="project-table"><caption class="visually-hidden">公开项目</caption><thead><tr><th scope="col">项目</th><th scope="col">状态</th><th scope="col">说明</th></tr></thead><tbody>${projects.map((project) => `<tr class="personal-project" id="project-${escape(project.id)}" tabindex="-1">
            <td><div class="personal-project__identity"><span class="personal-project__thumbnail personal-project__thumbnail--${escape(project.id)}" aria-hidden="true">${project.id === 'living-portrait' ? `<img src="${escape(`${base}assets/poetic-pixel/canonical.png?v=${poeticPixelAssets.canonicalSha256}`)}" alt="" width="64" height="64" loading="lazy" decoding="async">` : pixelIcon('chess')}</span><div><a class="personal-project__link" href="${escape(project.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`${project.title} — ${project.subtitle}，打开项目（在新标签页打开）`)}"><span class="personal-project__heading">${escape(project.title)} ${arrow}</span></a><span class="personal-project__subtitle">${escape(project.subtitle)}</span>${project.kind || project.year ? `<p class="personal-project__meta">${escape([project.kind, project.year].filter(Boolean).join(' · '))}</p>` : ''}</div></div></td>
            <td><span class="personal-project__status personal-project__status--${project.status === 'active' ? 'active' : 'archived'}"><span aria-hidden="true"></span>${project.status === 'active' ? '持续制作中' : '已归档'}</span></td>
            <td><p class="personal-project__description">${escape(project.description)}</p><ul class="personal-project__tags" aria-label="项目技术">${project.tags.map((tag) => `<li>${escape(tag)}</li>`).join('')}</ul>${project.highlights?.length || project.note ? `<details class="personal-project__details"><summary><span>项目亮点</span>${project.highlights?.length ? `<span class="personal-project__detail-count">${project.highlights.length}</span>` : ''}${pixelIcon('arrow-down')}</summary><div class="personal-project__details-body">${project.highlights?.length ? `<ul class="personal-project__highlights">${project.highlights.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : ''}${project.note ? `<p class="personal-project__note">${escape(project.note)}</p>` : ''}</div></details>` : ''}</td>
          </tr>`).join('')}</tbody></table></div>
          <blockquote class="document-note">每个作品都链接到真实的公开源码；已归档的项目保留当时的探索。</blockquote>
        </div>
      </section>
      ${renderInterests(site, base)}
      ${renderGames(site, base)}
      ${renderSocials(site, base)}
    </main>
    <aside class="site-toc" aria-labelledby="toc-title"><span class="pixel-lantern pixel-lantern--toc" aria-hidden="true"></span><h2 id="toc-title">${renderNavigationIcon('#work')}<span>目录</span></h2><nav aria-label="本页目录">${contents.map((item) => `<a href="${escape(item.href)}"${item.href === '#home' ? ' class="is-active" aria-current="location"' : ''}>${renderNavigationIcon(item.href)}<span>${escape(item.label)}</span></a>`).join('')}</nav>${repository ? `<a class="site-toc__source" href="${escape(repository)}" target="_blank" rel="noopener noreferrer">查看本站源码 ${arrow}</a>` : ''}</aside>
  </div>
  <footer class="site-footer site-container"><p>© ${new Date().getFullYear()} ${escape(site.fullName)}<span class="site-footer__note">一格一格，慢慢建造。</span></p><a href="#top">回到顶端 ↑</a>${github ? `<a href="${escape(github)}" target="_blank" rel="noopener noreferrer">GitHub ${arrow}</a>` : ''}</footer>
</div>`
}
