import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { protectStaticHtml } from '../build/securityPolicy.ts'

const script = (id, body) => `<script id="${id}">${body}</script>`
const source = `<html><head><meta charset="UTF-8" /></head><body>${script('site-parser-bootstrap', '\nbootstrap();\n')}${script('site-startup-watchdog', 'watch();')}<script type="module" src="/assets/app.js"></script></body></html>`

test('production CSP hashes exact owned startup scripts while keeping same-origin modules', () => {
  const result = protectStaticHtml(source)
  for (const body of ['\nbootstrap();\n', 'watch();']) {
    const hash = createHash('sha256').update(body).digest('base64')
    assert.ok(result.includes(`'sha256-${hash}'`))
  }
  assert.ok(result.includes("script-src 'self'"))
  assert.ok(!result.includes("script-src 'self' 'unsafe-inline'"))
  assert.ok(!result.includes('unsafe-eval'))
  assert.ok(result.includes("object-src 'none'; base-uri 'none'; form-action 'none'"))
  assert.ok(result.includes('name="referrer"'))
  assert.ok(result.indexOf('Content-Security-Policy') < result.indexOf('<script'))
})

test('production CSP fails closed for unexpected, duplicate or missing inline scripts', () => {
  assert.throws(() => protectStaticHtml(source.replace('</body>', '<script>unexpected()</script></body>')))
  assert.throws(() => protectStaticHtml(source.replace('</body>', script('site-parser-bootstrap', 'duplicate()') + '</body>')))
  assert.throws(() => protectStaticHtml(source.replace(script('site-startup-watchdog', 'watch();'), '')))
})

test('escaped user content is text and does not prevent safe static publication', () => {
  const result = protectStaticHtml(source.replace('</body>', '<p>&lt;img src=x onerror=alert(1)&gt;</p></body>'))
  assert.ok(result.includes('&lt;img src=x onerror=alert(1)&gt;'))
})
