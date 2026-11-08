import { createHash } from 'node:crypto'

const trustedInlineScripts = new Set(['site-parser-bootstrap', 'site-startup-watchdog'])

/** Hash only the two owned startup scripts after Vite's HTML transforms. */
export const protectStaticHtml = (html: string): string => {
  const hashes: string[] = []
  const found = new Set<string>()
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attributes = match[1] ?? ''
    if (/\bsrc\s*=/i.test(attributes)) continue
    const id = attributes.match(/\bid="([^"]+)"/)?.[1]
    if (!id || !trustedInlineScripts.has(id) || found.has(id)) {
      throw new Error('Unexpected inline script in production HTML.')
    }
    found.add(id)
    hashes.push(`'sha256-${createHash('sha256').update(match[2] ?? '').digest('base64')}'`)
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
  const charset = '<meta charset="UTF-8" />'
  if (!html.includes(charset)) throw new Error('Missing UTF-8 HTML declaration.')
  return html.replace(charset, `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`)
}
