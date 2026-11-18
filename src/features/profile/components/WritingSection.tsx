import { getJournalEntries, getThoughtEntries } from '../content/selectors'
import type { SiteContent } from '../content/types'
import { getNavigationIconPath } from '../content/navigationIcons'
import PixelIcon from './PixelIcon'
import { getJournalDates } from '../content/journalPresentation'

export type WritingSpace = 'journal' | 'thoughts'

export default function WritingSection({ content, kind = 'journal' }: { content: SiteContent; kind?: WritingSpace }) {
  const isThoughts = kind === 'thoughts'
  const spaceId = isThoughts ? 'thoughts' : 'journal'
  const entryPrefix = isThoughts ? 'thought' : 'note'
  const title = isThoughts ? '思绪' : '成长手记'
  const entries = isThoughts ? getThoughtEntries(content) : getJournalEntries(content)
  if (!entries.length) return null
  return <section className={`personal-section${isThoughts ? ' thoughts-space' : ''}`} id={spaceId} aria-labelledby={`${spaceId}-title`} tabIndex={-1}>
    <div className="personal-section__label"><h2 id={`${spaceId}-title`}><span aria-hidden="true"><svg className="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"><path fillRule="evenodd" d={getNavigationIconPath(`#${spaceId}`)} /></svg></span> {title}</h2></div>
    <p className="profile-section__intro">{isThoughts ? '把未解的问题写下来，也把向前的念头留住。' : '写下困惑，也记录想出发的时刻。'}</p>
    <div className="journal-entries">{entries.map(entry => <article className="journal-entry" id={`${entryPrefix}-${entry.id}`} aria-labelledby={`${entryPrefix}-${entry.id}-title`} tabIndex={-1} key={entry.id}>
      <header className="journal-entry__header">
        <p className="journal-entry__dates">{getJournalDates(entry).map(item => <span key={item.label}>{item.label}{item.date ? <> <time dateTime={item.date}>{item.display}</time></> : null}</span>)}</p>
        <h3 id={`${entryPrefix}-${entry.id}-title`}>{entry.title}</h3>
        <p className="journal-entry__subtitle">{entry.subtitle}</p>
        {entry.tags.length ? <ul className="journal-entry__tags" aria-label={`${title}主题`}>{entry.tags.map(tag => <li key={tag}>{tag}</li>)}</ul> : null}
      </header>
      <p className="journal-entry__excerpt">{entry.excerpt}</p>
      <details className="journal-entry__reading">
        <summary><span>阅读全文</span><PixelIcon name="arrow-down" /></summary>
        <div className="journal-entry__body">
          <p className="journal-entry__edition">{isThoughts ? '思绪整理 · 保留当时的感受与打算' : '原稿整理 · 保留当时的感受与打算'}</p>
          {entry.sections.map((section, index) => <section className="journal-entry__chapter" key={section.title} aria-labelledby={`${entryPrefix}-${entry.id}-chapter-${index}`}>
            <h4 id={`${entryPrefix}-${entry.id}-chapter-${index}`}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.title}</h4>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </section>)}
          <blockquote className="journal-entry__closing">{entry.closing}</blockquote>
          <p className="journal-entry__end">旅程还在继续。</p>
        </div>
      </details>
    </article>)}</div>
  </section>
}
