import type { WritingEntry } from './types.ts'

export const getWritingDates = (entry: WritingEntry): { label: string; date?: string; display?: string }[] => {
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
