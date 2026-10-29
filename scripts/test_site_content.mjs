import assert from 'node:assert/strict'
import test from 'node:test'
import { site } from '../src/content/site.ts'
import { escapeHtml, renderStaticSite } from '../src/content/staticMarkup.ts'

test('editable profile and projects provide usable content without requiring a code change', () => {
  assert.ok(site.name.trim() && site.intro.trim() && site.tagline.trim())
  assert.equal(new URL(site.github).protocol, 'https:')
  if (site.email) assert.match(site.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  assert.ok(site.projects.length > 0)
  assert.equal(new Set(site.projects.map(project => project.id)).size, site.projects.length)
  assert.ok(site.projects.every(project => project.title.trim() && new URL(project.href).protocol === 'https:'))
})

test('static HTML contains the complete personal site when JavaScript is unavailable', () => {
  const html = renderStaticSite(site, '/website/')
  for (const id of ['about', 'work', 'contact']) assert.ok(html.includes(`id="${id}"`))
  for (const project of site.projects) assert.ok(html.includes(project.title) && html.includes(project.href))
  assert.ok(html.includes('/website/portrait-rest.png'))
  assert.ok(html.includes(`mailto:${site.email}`))
  assert.ok(html.includes(site.intro))
})

test('editable content is escaped in initial HTML and empty email is omitted', () => {
  assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;')
  const html = renderStaticSite({ ...site, name: '<script>broken</script>', email: undefined })
  assert.ok(!html.includes('<script>broken</script>'))
  assert.ok(html.includes('&lt;script&gt;broken&lt;/script&gt;'))
  assert.ok(!html.includes('mailto:'))
})
