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

test('script ownership uses exact attribute names and rejects duplicate attributes', () => {
  for (const attributes of [
    'data-id="site-parser-bootstrap"',
    'id="site-parser-bootstrap" ID="site-startup-watchdog"',
    'id="site-parser-bootstrap" id="site-parser-bootstrap"',
  ]) {
    assert.throws(() => protectStaticHtml(source.replace('id="site-parser-bootstrap"', attributes)))
  }
  assert.throws(() => protectStaticHtml(source.replace('</body>', '<script data-src="/assets/app.js">unowned();</script></body>')))
  assert.throws(() => protectStaticHtml(source.replace('</body>', '<script src="/assets/a.js" SRC="/assets/b.js" type="module"></script></body>')))
})

test('quotes and boolean attributes preserve the exact startup bodies and document bytes', () => {
  const markup = source.replace('id="site-parser-bootstrap"', "ID = 'site-parser-bootstrap' data-note=\"a > b\"")
    .replace('type="module" src=', 'type=module crossorigin src=')
  const result = protectStaticHtml(markup)
  assert.ok(result.includes("ID = 'site-parser-bootstrap' data-note=\"a > b\""))
  assert.ok(result.includes('<script type=module crossorigin src="/assets/app.js"></script>'))
  for (const body of ['\nbootstrap();\n', 'watch();']) {
    assert.ok(result.includes(`'sha256-${createHash('sha256').update(body).digest('base64')}'`))
  }
  assert.equal(result.replace(/\n    <meta http-equiv="Content-Security-Policy"[^>]+>\n    <meta name="referrer"[^>]+>/, ''), markup)
})

test('CSP hashes HTML-normalized script line endings without rewriting output bytes', () => {
  for (const newline of ['\r\n', '\r']) {
    const body = `${newline}bootstrap();${newline}`
    const markup = source.replace('\nbootstrap();\n', body)
    const result = protectStaticHtml(markup)
    assert.ok(result.includes(script('site-parser-bootstrap', body)))
    assert.ok(result.includes(`'sha256-${createHash('sha256').update('\nbootstrap();\n').digest('base64')}'`))
    assert.ok(!result.includes(`'sha256-${createHash('sha256').update(body).digest('base64')}'`))
  }
})

test('comments and HTML raw-text examples do not become script inventory', () => {
  const example = '<script id="unowned">sample();</script><button onclick="sample()">sample</button>'
  const markup = source.replace('</body>', `<!--${example}--><textarea>${example}</textarea><title>${example}</title><style>/* ${example} */</style></body>`)
  assert.doesNotThrow(() => protectStaticHtml(markup))
  assert.throws(() => protectStaticHtml(source.replace(script('site-parser-bootstrap', '\nbootstrap();\n'), '<!--' + script('site-parser-bootstrap', '\nbootstrap();\n') + '-->')))
  assert.throws(() => protectStaticHtml(source.replace('<meta charset="UTF-8" />', '<!--<meta charset="UTF-8" />-->')))
})

test('actual inline handlers fail while handler-like text and attribute values remain inert', () => {
  for (const tag of ['<button onclick="sample()">sample</button>', '<svg><path ONLOAD="sample()"/></svg>']) {
    assert.throws(() => protectStaticHtml(source.replace('</body>', `${tag}</body>`)))
  }
  assert.doesNotThrow(() => protectStaticHtml(source.replace('</body>', '<p title="example: onclick=sample()">onclick=sample(); &lt;script&gt;</p></body>')))
})

test('external scripts are only normalized same-site JavaScript modules', () => {
  for (const src of ['/assets/app.js', '/website/assets/app-a_1.mjs', './assets/app.js', 'assets/app.js']) {
    assert.doesNotThrow(() => protectStaticHtml(source.replace('/assets/app.js', src)), src)
  }
  for (const src of [
    'https://example.invalid/app.js', '//example.invalid/app.js', 'javascript:sample()', 'data:text/javascript,sample()',
    '/assets/../app.js', './assets/../app.js', '/assets//app.js', '/assets/app.js?x=1', '&#47;assets/app.js', '/assets/app\\a.js',
  ]) assert.throws(() => protectStaticHtml(source.replace('/assets/app.js', src)), src)
  assert.throws(() => protectStaticHtml(source.replace('type="module"', 'type="text/javascript"')))
  assert.throws(() => protectStaticHtml(source.replace('src="/assets/app.js"></script>', 'src="/assets/app.js">ignored();</script>')))
  assert.throws(() => protectStaticHtml(source.replace('</body>', '<script src="https://example.invalid/unowned.js"></script></body>')))
})

test('unsupported malformed input fails closed rather than guessing browser parse states', () => {
  for (const fragment of [
    '<!-->bad-comment-->', '<!-- unclosed', '<!-- nested -- comment -->',
    '<script/>', '<script id="site-parser-bootstrap" data-note="unterminated>',
    '<div title="x"title="y"></div>', '<div title="x" title="y"></div>',
    '<svg><script id="site-parser-bootstrap">sample();</script></svg>',
    '<plaintext>rest', '<!unexpected>', '<div title="x\0y"></div>',
  ]) assert.throws(() => protectStaticHtml(source.replace('</body>', `${fragment}</body>`)), fragment)
  assert.throws(() => protectStaticHtml(source.replace('bootstrap();', '<!-- legacy script escape')))
  assert.throws(() => protectStaticHtml(source.replace('id="site-parser-bootstrap"', 'id="site-parser-bootstrap" type="application/json"')))
  assert.throws(() => protectStaticHtml(source.replace('<meta charset="UTF-8" />', '').replace('<body>', '<body><script type="module" src="/assets/early.js"></script><meta charset="UTF-8" />')))
})

test('owned startup scripts cannot be counted inside inert templates', () => {
  assert.throws(() => protectStaticHtml(source.replace(script('site-parser-bootstrap', '\nbootstrap();\n'), `<template>${script('site-parser-bootstrap', '\nbootstrap();\n')}</template>`)))
  assert.throws(() => protectStaticHtml(source.replace('</body>', '<template>even an empty template is outside our document format</template></body>')))
  assert.doesNotThrow(() => protectStaticHtml(source.replace('</body>', '<p>&lt;template&gt;example&lt;/template&gt;</p></body>')))
})

test('the policy is inserted only after the real charset in the literal document head', () => {
  const fake = '<!--<meta charset="UTF-8" />-->'
  const commentedPrefix = `${fake}\n${source}`
  const result = protectStaticHtml(commentedPrefix)
  assert.ok(result.startsWith(fake))
  assert.ok(result.indexOf('Content-Security-Policy') > result.indexOf('<head><meta charset="UTF-8" />'))
  for (const markup of [
    source.replace('<head><meta charset="UTF-8" /></head>', '<head></head>').replace('<body>', '<body><meta charset="UTF-8" />'),
    source.replace('<head><meta charset="UTF-8" /></head>', '<head></head><meta charset="UTF-8" />'),
    source.replace('<head>', '</html><head>'),
    source.replace('<head>', '<head/><head>'),
    source.replace('<head>', '<div><head>'),
    source.replace('<head>', '<head>unexpected text'),
    `unexpected text${source}`,
    source.replace('<meta charset="UTF-8" />', `${fake}<meta charset="UTF-8" />`),
  ]) assert.throws(() => protectStaticHtml(markup))
})
