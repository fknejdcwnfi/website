import { createHash } from 'node:crypto'
import { readHtmlInventory } from './htmlInventory.ts'

const trustedInlineScripts = new Set(['site-parser-bootstrap', 'site-startup-watchdog'])

/** Hash only the two owned startup scripts after Vite's HTML transforms. */
export const protectStaticHtml = (html: string): string => {
  const elements = readHtmlInventory(html)
  const [documentElement, head, charset] = elements
  // The owned document has a literal html/head/charset envelope. Do not infer HTML
  // error recovery or inject a meta policy into a synthetic/closed head or body.
  const prefix = html.slice(0, documentElement?.start ?? 0)
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<!doctype\s+html\s*>/gi, '')
  if (!documentElement || documentElement.name !== 'html' || documentElement.selfClosing ||
    !head || head.name !== 'head' || head.selfClosing ||
    !charset || charset.name !== 'meta' || charset.attributes.get('charset')?.toLowerCase() !== 'utf-8' ||
    prefix.trim() || html.slice(documentElement.end, head.start).trim() || html.slice(head.end, charset.start).trim()) {
    throw new Error('Missing literal html/head/UTF-8 document envelope.')
  }
  const hashes: string[] = []
  const found = new Set<string>()
  for (const element of elements) {
    const attributes = element.attributes
    if ([...attributes.keys()].some(name => /^on[a-z]/.test(name))) {
      throw new Error('Inline event handler in production HTML.')
    }
    if (element.name !== 'script') continue
    if (attributes.has('src')) {
      const src = attributes.get('src')
      // Generated module paths are normalized local JS files, without URL/entity ambiguity.
      if (attributes.get('type') !== 'module' || typeof src !== 'string' ||
        !/^(?:\/(?!\/)|\.\/)?[a-z0-9][a-z0-9._/-]*\.m?js$/i.test(src) ||
        src.replace(/^(?:\.\/|\/)/, '').split('/').some(segment => !segment || segment === '.' || segment === '..') ||
        element.body?.trim()) {
        throw new Error('Unexpected external script in production HTML.')
      }
      continue
    }
    const id = attributes.get('id')
    if (!id || !trustedInlineScripts.has(id) || found.has(id)) {
      throw new Error('Unexpected inline script in production HTML.')
    }
    if (attributes.has('type') && !['', 'text/javascript'].includes(attributes.get('type') ?? '')) {
      throw new Error('Unexpected startup script type in production HTML.')
    }
    found.add(id)
    // HTML input preprocessing normalizes CRLF/CR in script text before CSP checks.
    // Hash that text while leaving the emitted document bytes untouched.
    const scriptText = (element.body ?? '').replace(/\r\n?/g, '\n')
    hashes.push(`'sha256-${createHash('sha256').update(scriptText).digest('base64')}'`)
  }
  if (found.size !== trustedInlineScripts.size) {
    throw new Error('Missing startup script in production HTML.')
  }
  const policy = [
    "default-src 'none'", `script-src 'self' ${hashes.join(' ')}`,
    // Existing static/React scene sizing and particle positions use custom properties.
    "style-src 'self' 'unsafe-inline'",
    // A fixed historical CSS grain is an image data URI, never an executable script.
    "img-src 'self' data:", "font-src 'self'",
    "media-src 'self'", "connect-src 'self'", "worker-src 'self'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ')
  return `${html.slice(0, charset.end)}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />${html.slice(charset.end)}`
}
