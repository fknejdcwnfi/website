import type { JournalEntry } from './types.ts'

export const getJournalDates = (entry: JournalEntry): { label: string; date?: string; display?: string }[] => {
  const dates = [
    ...(entry.eventDate ? [{ label: '记录', date: entry.eventDate, display: entry.eventDate.replaceAll('-', '.') }] : []),
    ...(entry.writtenDate ? [{ label: '落笔', date: entry.writtenDate, display: entry.writtenDate.replaceAll('-', '.') }] : []),
  ]
  return dates.length ? dates : [{ label: '原稿未注明日期' }]
}
