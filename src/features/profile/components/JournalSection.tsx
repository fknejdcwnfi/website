import { getJournalEntries } from '../content/selectors'
import type { SiteContent } from '../content/types'
import { getNavigationIconPath } from '../content/navigationIcons'
import PixelIcon from './PixelIcon'

export default function JournalSection({ content }: { content: SiteContent }) {
  const entries = getJournalEntries(content)
  if (!entries.length) return null
  return <section className="personal-section" id="journal" aria-labelledby="journal-title" tabIndex={-1}>
    <div className="personal-section__label"><h2 id="journal-title"><span aria-hidden="true"><svg className="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"><path fillRule="evenodd" d={getNavigationIconPath('#journal')} /></svg></span> 成长手记</h2></div>
    <p className="profile-section__intro">写下困惑，也记录想出发的时刻。</p>
    <div className="journal-entries">{entries.map(entry => <article className="journal-entry" id={`note-${entry.id}`} aria-labelledby={`note-${entry.id}-title`} tabIndex={-1} key={entry.id}>
      <header className="journal-entry__header">
        <p className="journal-entry__dates"><span>记录 <time dateTime={entry.eventDate}>{entry.eventDate.replaceAll('-', '.')}</time></span><span>落笔 <time dateTime={entry.writtenDate}>{entry.writtenDate.replaceAll('-', '.')}</time></span></p>
        <h3 id={`note-${entry.id}-title`}>{entry.title}</h3>
        <p className="journal-entry__subtitle">{entry.subtitle}</p>
        {entry.tags.length ? <ul className="journal-entry__tags" aria-label="手记主题">{entry.tags.map(tag => <li key={tag}>{tag}</li>)}</ul> : null}
      </header>
      <p className="journal-entry__excerpt">{entry.excerpt}</p>
      <details className="journal-entry__reading">
        <summary><span>阅读全文</span><PixelIcon name="arrow-down" /></summary>
        <div className="journal-entry__body">
          <p className="journal-entry__edition">原稿整理 · 保留当时的感受与打算</p>
          {entry.sections.map((section, index) => <section className="journal-entry__chapter" key={section.title} aria-labelledby={`note-${entry.id}-chapter-${index}`}>
            <h4 id={`note-${entry.id}-chapter-${index}`}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.title}</h4>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </section>)}
          <blockquote className="journal-entry__closing">{entry.closing}</blockquote>
          <p className="journal-entry__end">旅程还在继续。</p>
        </div>
      </details>
    </article>)}</div>
  </section>
}
