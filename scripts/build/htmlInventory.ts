/** A restricted reader for our generated HTML, not a general HTML parser or sanitizer. */
export type HtmlElement = {
  name: string
  attributes: ReadonlyMap<string, string | null>
  start: number
  end: number
  selfClosing: boolean
  body?: string
}

type Tag = HtmlElement & { closing: boolean; selfClosing: boolean }
const space = (character: string | undefined): boolean => character !== undefined && /[\t\n\f\r ]/.test(character)
const unsupported = (): never => { throw new Error('Unsupported or malformed production HTML.') }

const readTag = (html: string, start: number): Tag => {
  let cursor = start + 1
  const closing = html[cursor] === '/'
  if (closing) cursor += 1
  const name = /^[a-z][a-z0-9:-]*/i.exec(html.slice(cursor))?.[0]
  if (!name) return unsupported()
  cursor += name.length
  const attributes = new Map<string, string | null>()
  while (cursor < html.length) {
    const hadSpace = space(html[cursor])
    while (space(html[cursor])) cursor += 1
    if (html[cursor] === '>') return { name: name.toLowerCase(), attributes, start, end: cursor + 1, closing, selfClosing: false }
    if (html.startsWith('/>', cursor) && !closing) {
      return { name: name.toLowerCase(), attributes, start, end: cursor + 2, closing, selfClosing: true }
    }
    if (closing || !hadSpace) return unsupported()
    const rawName = /^[a-z_:][a-z0-9_.:-]*/i.exec(html.slice(cursor))?.[0]
    if (!rawName) return unsupported()
    const attribute = rawName.toLowerCase()
    if (attributes.has(attribute)) return unsupported()
    cursor += rawName.length
    const afterName = cursor
    while (space(html[cursor])) cursor += 1
    let value: string | null = null
    if (html[cursor] === '=') {
      cursor += 1
      while (space(html[cursor])) cursor += 1
      const quote = html[cursor]
      if (quote === '"' || quote === "'") {
        const end = html.indexOf(quote, cursor + 1)
        if (end < 0) return unsupported()
        value = html.slice(cursor + 1, end)
        cursor = end + 1
      } else {
        const startValue = cursor
        while (cursor < html.length && !space(html[cursor]) && html[cursor] !== '>') {
          if (/["'`=<>]/.test(html[cursor]!)) return unsupported()
          cursor += 1
        }
        value = html.slice(startValue, cursor)
        if (!value) return unsupported()
      }
    } else cursor = afterName
    attributes.set(attribute, value)
  }
  return unsupported()
}

const rawTextElements = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'])

/** Preserve source bytes while inventorying actual tags, ignoring comments and raw text. */
export const readHtmlInventory = (html: string): HtmlElement[] => {
  if (html.includes('\0')) return unsupported()
  const elements: HtmlElement[] = []
  const foreignRoots: string[] = []
  let cursor = 0
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor)
    if (start < 0) break
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4)
      if (end < 0) return unsupported()
      const comment = html.slice(start + 4, end)
      if (comment.startsWith('>') || comment.startsWith('->') || comment.includes('--')) return unsupported()
      cursor = end + 3
      continue
    }
    if (/^<!doctype\s+html\s*>/i.test(html.slice(start))) {
      cursor = start + /^<!doctype\s+html\s*>/i.exec(html.slice(start))![0].length
      continue
    }
    const tag = readTag(html, start)
    if (tag.closing) {
      if (tag.name === 'svg' || tag.name === 'math') {
        if (foreignRoots.pop() !== tag.name) return unsupported()
      }
      cursor = tag.end
      continue
    }
    if (tag.name === 'plaintext' || tag.name === 'template' || (tag.name === 'script' && foreignRoots.length)) return unsupported()
    if (rawTextElements.has(tag.name) && !foreignRoots.length) {
      if (tag.selfClosing) return unsupported()
      const closePattern = new RegExp(`</${tag.name}(?=[\\t\\n\\f\\r />])`, 'ig')
      closePattern.lastIndex = tag.end
      const close = closePattern.exec(html)
      if (!close) return unsupported()
      const closingTag = readTag(html, close.index)
      const body = html.slice(tag.end, close.index)
      // HTML's legacy script escaped/double-escaped modes are outside this reader.
      if (tag.name === 'script' && body.includes('<!--')) return unsupported()
      elements.push({ ...tag, body })
      cursor = closingTag.end
      continue
    }
    elements.push(tag)
    if ((tag.name === 'svg' || tag.name === 'math') && !tag.selfClosing) foreignRoots.push(tag.name)
    cursor = tag.end
  }
  if (foreignRoots.length) return unsupported()
  return elements
}
