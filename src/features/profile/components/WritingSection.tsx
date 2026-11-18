import { getWritingAnchor, getWritingEntries } from '../content/selectors'
import type { SiteContent } from '../content/types'
import { getNavigationIconPath } from '../content/navigationIcons'
import PixelIcon from './PixelIcon'
import { getWritingDates, getWritingTags } from '../content/writingPresentation'

export default function WritingSection({ content }: { content: SiteContent }) {
  const title = '思绪与日志'
  const entries = getWritingEntries(content)
  if (!entries.length) return null
  return <section className="personal-section writing-space" id="writing" aria-labelledby="writing-title" tabIndex={-1}>
    <span className="writing-space__legacy-anchor" id="journal" aria-hidden="true" />
    <span className="writing-space__legacy-anchor" id="thoughts" aria-hidden="true" />
    <div className="personal-section__label"><h2 id="writing-title"><span aria-hidden="true"><svg className="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"><path fillRule="evenodd" d={getNavigationIconPath('#writing')} /></svg></span> {title}</h2></div>
    <p className="profile-section__intro">把想法写下来，也把走过的日子留下来。</p>
    <div className="writing-entries">{entries.map(entry => {
      const anchor = getWritingAnchor(entry)
      const kindLabel = entry.kind === 'thought' ? '思绪' : '日志'
      const tags = getWritingTags(entry)
      return <article className="writing-entry" id={anchor} aria-labelledby={`${anchor}-title`} tabIndex={-1} key={anchor}>
      <header className="writing-entry__header">
        <p className="writing-entry__dates">{getWritingDates(entry).map(item => <span key={item.label}>{item.label}{item.date ? <> <time dateTime={item.date}>{item.display}</time></> : null}</span>)}</p>
        <p className="writing-entry__kind">{kindLabel}</p>
        <h3 id={`${anchor}-title`}>{entry.title}</h3>
        <p className="writing-entry__subtitle">{entry.subtitle}</p>
        {tags.length ? <ul className="writing-entry__tags" aria-label={`${kindLabel}主题`}>{tags.map(tag => <li key={tag}>{tag}</li>)}</ul> : null}
      </header>
      <p className="writing-entry__excerpt">{entry.excerpt}</p>
      <details className="writing-entry__reading">
        <summary><span>阅读全文</span><PixelIcon name="arrow-down" /></summary>
        <div className="writing-entry__body">
          <p className="writing-entry__edition">{kindLabel}整理 · 保留当时的感受与打算</p>
          {entry.sections.map((section, index) => <section className="writing-entry__chapter" key={section.title} aria-labelledby={`${anchor}-chapter-${index}`}>
            <h4 id={`${anchor}-chapter-${index}`}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.title}</h4>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </section>)}
          <blockquote className="writing-entry__closing">{entry.closing}</blockquote>
          <p className="writing-entry__end">旅程还在继续。</p>
        </div>
      </details>
    </article>})}</div>
  </section>
}
