import type { SiteContent } from '../content/types'
import { getNavigationIconPath } from '../content/navigationIcons'
import PixelIcon from './PixelIcon'
import { getWritingCards, WRITING_INDEX_LABEL, WRITING_INTRO } from '../content/writingPresentation'

export default function WritingSection({ content }: { content: SiteContent }) {
  const title = '思绪与日志'
  const cards = getWritingCards(content)
  if (!cards.length) return null
  return <section className="personal-section writing-space" id="writing" aria-labelledby="writing-title" tabIndex={-1}>
    <span className="writing-space__legacy-anchor" id="journal" aria-hidden="true" />
    <span className="writing-space__legacy-anchor" id="thoughts" aria-hidden="true" />
    <div className="personal-section__label"><h2 id="writing-title"><span aria-hidden="true"><svg className="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"><path fillRule="evenodd" d={getNavigationIconPath('#writing')} /></svg></span> {title}</h2></div>
    <p className="profile-section__intro">{WRITING_INTRO}</p>
    {cards.length > 1 && <nav className="writing-space__index" aria-label={WRITING_INDEX_LABEL}>
      <ul>{cards.map(({ entry, anchor, href }) => <li key={anchor}><a href={href}>{entry.title}</a></li>)}</ul>
    </nav>}
    <div className="writing-entries">{cards.map(({ entry, anchor, titleId, kindLabel, dates, tags, chapters }) => (
      <article className="writing-entry" id={anchor} aria-labelledby={titleId} tabIndex={-1} key={anchor}>
        <header className="writing-entry__header">
          <p className="writing-entry__dates">{dates.map(item => <span key={item.label}>{item.label}{item.date !== undefined ? <> <time dateTime={item.date}>{item.display}</time></> : null}</span>)}</p>
          <p className="writing-entry__kind">{kindLabel}</p>
          <h3 id={titleId}>{entry.title}</h3>
          <p className="writing-entry__subtitle">{entry.subtitle}</p>
          {tags.length ? <ul className="writing-entry__tags" aria-label={`${kindLabel}主题`}>{tags.map(tag => <li key={tag}>{tag}</li>)}</ul> : null}
        </header>
        <p className="writing-entry__excerpt">{entry.excerpt}</p>
        <details className="writing-entry__reading">
          <summary><span>阅读全文</span><PixelIcon name="arrow-down" /></summary>
          <div className="writing-entry__body">
            <p className="writing-entry__edition">{kindLabel}整理 · 保留当时的感受与打算</p>
            {chapters.map(chapter => <section className="writing-entry__chapter" key={chapter.titleId} aria-labelledby={chapter.titleId}>
              <h4 id={chapter.titleId}>{chapter.title}</h4>
              {chapter.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </section>)}
            <blockquote className="writing-entry__closing">{entry.closing}</blockquote>
            <p className="writing-entry__end">旅程还在继续。</p>
          </div>
        </details>
      </article>
    ))}</div>
  </section>
}
