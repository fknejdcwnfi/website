import assert from 'node:assert/strict'
import test from 'node:test'
import { createSearchIndex, searchIndex } from '../../src/features/profile/content/searchIndex.ts'
import { searchSite } from '../../src/features/profile/content/selectors.ts'

const entry = (id, title, text) => ({ id, title, text, href: `#${id}`, excerpt: '' })
const legacySearch = (entries, query) => {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter(value => tokens.every(token => `${value.title} ${value.text}`.toLocaleLowerCase().includes(token))).slice(0, 8)
}

test('prepared search preserves literal multilingual tokens and source order', () => {
  const entries = [
    entry('first', 'Pixel study', '学习 JavaScript [draft] a+b'),
    entry('second', '学习记录', 'pixel Unicode İstanbul \\path'),
    entry('third', '另一页', 'JavaScript <tag> (text) . *'),
  ]
  const original = structuredClone(entries)
  const index = createSearchIndex(entries)
  for (const query of ['', '  ', 'PIXEL', '学习 pixel', 'pixel\n学习', '[draft]', 'a+b', '<tag>', '(text)', '.', '*', '\\path', 'İstanbul', '未匹配']) {
    assert.deepEqual(searchIndex(index, query), legacySearch(entries, query), query)
    assert.deepEqual(searchSite(entries, query), legacySearch(entries, query), query)
  }
  assert.deepEqual(entries, original)
  assert.equal(searchIndex(index, 'a+b')[0], entries[0])
})

test('prepared search retains the first eight matching entries and empty behavior', () => {
  const entries = Array.from({ length: 12 }, (_, index) => entry(`record-${index}`, `Record ${index}`, 'matching text'))
  const index = createSearchIndex(entries)
  for (const query of ['', 'matching', 'record matching']) {
    assert.deepEqual(searchIndex(index, query).map(item => item.id), entries.slice(0, 8).map(item => item.id))
  }
  assert.deepEqual(searchIndex(index, 'no result'), [])
  assert.deepEqual(searchIndex(createSearchIndex([]), ''), [])
})

test('new content snapshots rebuild their normalized text without global caching', () => {
  const entries = [entry('record', 'Original', 'first version')]
  assert.deepEqual(searchSite(entries, 'updated'), [])
  entries[0].text = 'updated version'
  assert.deepEqual(searchSite(entries, 'updated').map(item => item.id), ['record'])
  assert.deepEqual(searchIndex(createSearchIndex(entries), 'first'), [])
  entries.push(entry('second', 'Updated', 'second version'))
  assert.deepEqual(searchIndex(createSearchIndex(entries), 'updated').map(item => item.id), ['record', 'second'])
})
