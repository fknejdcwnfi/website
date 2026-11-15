import type { SiteSearchEntry } from './types.ts'

export type SiteSearchIndex = readonly { entry: SiteSearchEntry; text: string }[]

/** Build once per content snapshot; no mutable module-level cache. */
export const createSearchIndex = (entries: readonly SiteSearchEntry[]): SiteSearchIndex => entries.map(entry => ({
  entry, text: `${entry.title} ${entry.text}`.toLocaleLowerCase(),
}))

/** Literal tokens only; queries never become regular expressions or markup. */
export const searchIndex = (index: SiteSearchIndex, query: string): SiteSearchEntry[] => {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matches: SiteSearchEntry[] = []
  for (const item of index) {
    if (!tokens.every(token => item.text.includes(token))) continue
    matches.push(item.entry)
    if (matches.length === 8) break
  }
  return matches
}
