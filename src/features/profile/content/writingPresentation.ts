import { getWritingAnchor, getWritingEntries } from './selectors.ts'
import type { SiteContent, WritingEntry } from './types.ts'

export const WRITING_INTRO = '把想法写下来，也把走过的日子留下来。'
export const WRITING_INDEX_LABEL = '本栏索引'

type WritingDate = { label: string; date: string; display: string } | { label: string; date?: undefined }

export const getWritingDates = (entry: WritingEntry): WritingDate[] => {
  const dates = [
    ...(entry.eventDate ? [{ label: '记录', date: entry.eventDate, display: entry.eventDate.replaceAll('-', '.') }] : []),
    ...(entry.writtenDate ? [{ label: '落笔', date: entry.writtenDate, display: entry.writtenDate.replaceAll('-', '.') }] : []),
  ]
  return dates.length ? dates : [{ label: '原稿未注明日期' }]
}

/** The kind badge already names this category, so omit its duplicate topical chip. */
export const getWritingTags = (entry: WritingEntry): string[] => {
  const category = entry.kind === 'thought' ? '思绪' : '成长手记'
  return entry.tags.filter(tag => tag !== category)
}

/** Derive the same index links and card metadata for both renderers. */
export const getWritingCards = (content: SiteContent) => getWritingEntries(content).map(entry => {
  const anchor = getWritingAnchor(entry)
  return {
    entry,
    anchor,
    href: `#${anchor}`,
    // Authored IDs allow single hyphens. Keep internal headings out of their namespace.
    titleId: `${anchor}--title`,
    kindLabel: entry.kind === 'thought' ? '思绪' : '日志',
    dates: getWritingDates(entry),
    tags: getWritingTags(entry),
    chapters: entry.sections.map((chapter, index) => ({ ...chapter, titleId: `${anchor}--chapter-${index}` })),
  }
})
