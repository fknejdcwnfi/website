import assert from 'node:assert/strict'
import test from 'node:test'
import { site, getGameProfiles, getSiteNavigation, getSocialLinks } from '../../src/features/profile/content/site.ts'
import { escapeHtml, renderStaticSite } from '../../src/features/profile/content/staticMarkup.ts'
import { fitPixelViewport } from '../../src/features/profile/presentation/pixelViewport.ts'

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

test('empty future profiles create no placeholder accounts or game navigation', () => {
  assert.deepEqual(getGameProfiles(site), [])
  assert.deepEqual(getSocialLinks(site).map(profile => profile.platform), ['github', 'email'])
  assert.ok(!getSiteNavigation(site).some(link => link.href === '#games'))
  const html = renderStaticSite(site)
  assert.ok(!html.includes('id="games"'))
  assert.ok(!html.includes('Bilibili') && !html.includes('Douyin'))
})

test('real optional profiles add working social links, game details and matching static navigation', () => {
  const configured = { ...site,
    socials: [{ id: 'bilibili', platform: 'bilibili', label: 'B站', href: 'https://space.bilibili.com/1', handle: '公開名稱' },
      { id: 'douyin', platform: 'douyin', label: '抖音', href: 'https://www.douyin.com/user/example', handle: '另一個公開名稱' }],
    gameProfiles: [{ id: 'honor', game: 'honor-of-kings', label: '王者荣耀', playerName: '測試玩家', region: '測試區' },
      { id: 'naruto', game: 'naruto', label: '火影忍者', playerId: 'test-public-id' }],
  }
  assert.equal(getSocialLinks(configured).length, 4)
  assert.equal(getGameProfiles(configured).length, 2)
  assert.equal(getSiteNavigation(configured).filter(link => link.href === '#games').length, 1)
  const html = renderStaticSite(configured)
  for (const text of ['id="games"', 'href="#games"', '測試玩家', 'test-public-id', '測試區', 'https://space.bilibili.com/1']) assert.ok(html.includes(text))
  assert.ok(!html.includes('href="undefined"'))
})

test('optional profiles reject unusable links and escape user-provided player text', () => {
  const configured = { ...site,
    socials: [{ id: 'bad', platform: 'other', label: 'bad', href: 'javascript:alert(1)' }],
    gameProfiles: [{ id: 'blank', game: 'other', label: '空白' },
      { id: 'valid', game: 'other', label: '<img src=x onerror=alert(1)>', playerName: '<script>unsafe</script>', href: 'javascript:alert(1)' }],
  }
  assert.equal(getSocialLinks(configured).length, 2)
  assert.equal(getGameProfiles(configured).length, 1)
  assert.equal(getGameProfiles(configured)[0].href, undefined)
  const html = renderStaticSite(configured)
  assert.ok(!html.includes('javascript:') && !html.includes('<script>unsafe</script>') && !html.includes('<img src=x'))
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'))
})


test('pixel portrait sizing keeps art pixels and origins aligned across screen scales', () => {
  const nearly = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-7, `${value} ≈ ${expected}`)
  for (const ratio of [1, 1.25, 1.5, 2, 3]) for (const grid of [192, 256, 320]) {
    for (const width of [342, 720, 1180]) {
      const left = 13.3, top = 47.125
      const fit = fitPixelViewport(width, left, top, grid, ratio)
      assert.ok(fit.diameter <= Math.min(width, 512) + 1e-7)
      if (Math.min(width, 512) * ratio >= grid) assert.ok(Number.isInteger(fit.scale) && fit.scale >= 1)
      nearly(fit.diameter * ratio, fit.scale * grid)
      const x = (left + (width - fit.diameter) / 2 + fit.offsetX) * ratio
      const y = (top + fit.offsetY) * ratio
      nearly(x, Math.round(x))
      nearly(y, Math.round(y))
      assert.ok(Math.abs(fit.offsetX * ratio) <= 0.5 + 1e-7, 'centering changes by at most half a device pixel')
      assert.ok(Math.abs(fit.offsetY * ratio) <= 0.5 + 1e-7)
    }
  }
})

test('a narrow portrait viewport fits without demanding a full logical-grid width', () => {
  for (const width of [80, 128, 220]) for (const ratio of [1, 1.25, 2]) {
    const fit = fitPixelViewport(width, 0, 0, 256, ratio)
    assert.ok(fit.diameter > 0 && fit.diameter <= width)
    assert.ok(Object.values(fit).every(Number.isFinite))
  }
  assert.equal(fitPixelViewport(720, 0, 0, 256, 1).diameter, 512)
  assert.equal(fitPixelViewport(342, 0, 0, 256, 1).diameter, 256)
  assert.equal(fitPixelViewport(342, 0, 0, 256, 2).diameter, 256)
})
