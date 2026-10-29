import type { SiteContent } from './site.ts'

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const escape = escapeHtml

/** Real initial HTML remains usable when a module fails or JavaScript is disabled. */
export const renderStaticSite = (site: SiteContent, base = '/'): string => `
<div class="static-site">
  <div class="static-wrap">
    <header class="static-header"><a href="#top">${escape(site.name)}.</a><nav aria-label="主要導覽">${site.navigation.map((item) => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join('')}</nav></header>
    <main id="main-content">
      <section id="top" class="static-hero"><div><p class="static-eyebrow">${escape(site.intro)}</p><h1>你好，我是<br>${escape(site.name)}.</h1><p>${escape(site.tagline)}</p><a href="#work">看看我的作品 ↘</a></div><img src="${base}portrait-rest.png" width="768" height="768" fetchpriority="high" alt="Vermouth 的像素肖像：白金捲髮、冰藍眼睛與藍寶石飾物"></section>
      <section id="about" class="static-section"><h2>關於我</h2>${site.about.map((text) => `<p>${escape(text)}</p>`).join('')}</section>
      <section id="work" class="static-section"><h2>作品與嘗試</h2><div class="static-projects">${site.projects.map((project) => `<article><p class="static-eyebrow">${escape(project.subtitle)} · ${project.status === 'archived' ? '已封存' : '持續製作'}</p><h3><a href="${escape(project.href)}">${escape(project.title)} ↗</a></h3><p>${escape(project.description)}</p></article>`).join('')}</div></section>
      <section id="contact" class="static-section"><h2>一起聊聊？</h2><p>從一個想法開始。</p><a href="${escape(site.github)}">在 GitHub 找我 ↗</a>${site.email ? `<p><a href="mailto:${escape(site.email)}">${escape(site.email)}</a></p>` : ''}</section>
    </main>
    <footer class="static-footer">${escape(site.fullName)} · <a href="${escape(site.github)}">GitHub ↗</a><noscript><p>目前顯示靜態版本；介紹、作品與聯絡連結仍可使用。</p></noscript></footer>
  </div>
</div>`
