import assert from 'node:assert/strict'
import test from 'node:test'
import { site, getInterests, resolveProfileAsset, getGameProfiles, getSiteNavigation, getSocialLinks, getSiteSearchEntries, getTableOfContents, searchSite } from '../../src/features/profile/content/site.ts'
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
  assert.ok(html.includes('/website/assets/poetic-pixel/canonical.png'))
  assert.ok(html.includes('width="2864" height="2136"'))
  assert.ok(!html.includes('scenery.webp'))
  assert.ok(!html.includes('vermouth-bootstrap'))
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

test('empty optional modules create no placeholder accounts or navigation', () => {
  const empty = { ...site, interests: [], gameProfiles: [], socials: [] }
  assert.deepEqual(getGameProfiles(empty), [])
  assert.deepEqual(getSocialLinks(site).map(profile => profile.platform), ['github', 'email'])
  assert.ok(!getSiteNavigation(empty).some(link => ['#games', '#interests'].includes(link.href)))
  const html = renderStaticSite(empty)
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

test('local search finds confirmed content with mixed case and multiple words', () => {
  const entries = getSiteSearchEntries(site)
  assert.ok(searchSite(entries, '  jAvA   象棋  ').some(entry => entry.id === 'xiangqi-review'))
  assert.ok(searchSite(entries, 'Vermouth').some(entry => entry.id === 'living-portrait'))
  assert.deepEqual(searchSite(entries, 'fknejdcwnfi@gmail.com').map(entry => entry.id), ['contact'])
  for (const query of ['jAvA non-matching-project-271828', '.*', '[Java]', '<img src=x onerror=alert(1)>']) {
    assert.deepEqual(searchSite(entries, query), [], `literal unmatched query: ${query}`)
  }
})

test('search results and table of contents point to real static sections', () => {
  const html = renderStaticSite(site)
  for (const entry of [...getSiteSearchEntries(site), ...getTableOfContents(site)]) {
    assert.ok(entry.href.startsWith('#'))
    assert.ok(html.includes(`id="${escapeHtml(entry.href.slice(1))}"`), `missing target: ${entry.href}`)
  }
  assert.ok(getSiteSearchEntries(site).some(entry => entry.href === '#game-honor-of-kings'))
  assert.ok(getTableOfContents(site).some(entry => entry.href === '#games'))
})

test('configured games become searchable without exposing invalid account links', () => {
  const configured = { ...site, gameProfiles: [{ id: 'public-player', game: 'other', label: '遊戲', playerName: '公開玩家', href: 'javascript:alert(1)' }] }
  const matches = searchSite(getSiteSearchEntries(configured), '公開玩家')
  assert.equal(matches.length, 1)
  assert.equal(matches[0].href, '#game-public-player')
  assert.ok(getTableOfContents(configured).some(entry => entry.href === '#games'))
  assert.ok(!renderStaticSite(configured).includes('javascript:'))
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


test('owner-requested interests and game area work without invented player details', () => {
  assert.deepEqual(getInterests(site).map(interest => interest.title), ['火影忍者', '名侦探柯南'])
  const games = getGameProfiles(site)
  assert.equal(games.length, 1)
  assert.equal(games[0].label, '王者荣耀')
  for (const key of ['playerName', 'playerId', 'region']) assert.equal(games[0][key], undefined)
  assert.deepEqual(games[0].blocks, [])
  assert.deepEqual(site.socials, [])
  const html = renderStaticSite(site)
  for (const anchor of ['interests', 'interest-naruto', 'interest-detective-conan', 'games', 'game-honor-of-kings']) {
    assert.ok(html.includes(`id="${anchor}"`), anchor)
  }
  assert.ok(!html.includes('段位'))
})

test('WeChat and QQ can display real account text without a made-up profile URL', () => {
  const configured = { ...site, socials: [
    { id: 'wechat', platform: 'wechat', label: '微信', handle: '  qa-wechat  ', description: '联系说明' },
    { id: 'qq', platform: 'qq', label: 'QQ', handle: 'qa-qq' },
    { id: 'blank', platform: 'other', label: '未提供' },
  ] }
  const links = getSocialLinks(configured)
  assert.equal(links.length, 4)
  assert.equal(links.find(profile => profile.id === 'wechat').handle, 'qa-wechat')
  assert.equal(links.find(profile => profile.id === 'qq').href, undefined)
  const html = renderStaticSite(configured)
  for (const account of ['qa-wechat', 'qa-qq', '联系说明']) assert.ok(html.includes(account))
  assert.ok(!html.includes('href="undefined"') && !html.includes('未提供'))
})

test('profile media stays local and works with a GitHub Pages base path', () => {
  assert.equal(resolveProfileAsset('media/profile/qr.png', '/website/'), '/website/media/profile/qr.png')
  assert.equal(resolveProfileAsset('media/profile/screen.webp', '/website'), '/website/media/profile/screen.webp')
  for (const source of ['../secret.png', 'media/../secret.png', '/external.png', '//tracker/image.png',
    'https://tracker.test/image.png', 'media//qr.png', 'media/a.svg', 'media/a.png?tracker=1', 'media/a.png#x', 'data:image/png;base64,a']) {
    assert.equal(resolveProfileAsset(source, '/website/'), undefined, source)
  }
  const configured = { ...site, socials: [{ id: 'wechat', platform: 'wechat', label: '微信', qrCode: 'media/profile/qr.png' }] }
  assert.equal(getSocialLinks(configured).length, 3)
  assert.ok(renderStaticSite(configured, '/website/').includes('/website/media/profile/qr.png'))
})

test('ordered custom game blocks support public content without publishing a player ID', () => {
  const linked = { ...site, gameProfiles: [{ id: 'linked', game: 'other', label: '只放主页', href: 'https://example.com/game' }] }
  assert.equal(getGameProfiles(linked).length, 1)
  assert.ok(renderStaticSite(linked).includes('https://example.com/game'))
  assert.equal(getGameProfiles({ ...linked, gameProfiles: [{ ...linked.gameProfiles[0], href: 'javascript:alert(1)' }] }).length, 0)
  const regionOnly = { ...site, gameProfiles: [{ id: 'region-only', game: 'other', label: '只公开区服', region: '测试区服' }] }
  assert.equal(getGameProfiles(regionOnly).length, 1)
  assert.ok(renderStaticSite(regionOnly).includes('测试区服'))
  const configured = { ...site, gameProfiles: [{ id: 'showcase', game: 'honor-of-kings', label: '自定义游戏', blocks: [
    { id: 'notes', kind: 'notes', title: '我的文字', text: '只在测试夹具出现的记录', expanded: true },
    { id: 'facts', kind: 'facts', title: '自选数据', items: [{ label: '测试标签', value: '自定义值' }] },
    { id: 'collection', kind: 'collection', title: '角色收藏', items: [{ name: '测试角色', note: '自选说明' }] },
    { id: 'gallery', kind: 'gallery', title: '画面收藏', items: [{ title: '测试画面', src: 'media/profile/scene.png' }] },
    { id: 'links', kind: 'links', title: '精彩链接', items: [{ title: '测试视频', href: 'https://example.com/video', description: '视频链接说明' }] },
  ] }] }
  const blocks = getGameProfiles(configured)[0].blocks
  assert.deepEqual(blocks.map(block => block.kind), ['notes', 'facts', 'collection', 'gallery', 'links'])
  assert.equal(blocks[0].expanded, true)
  assert.equal(blocks[1].expanded, false)
  const html = renderStaticSite(configured, '/website/')
  for (const text of ['我的文字', '自选数据', '自定义值', '测试角色', '测试画面', '精彩链接', '/website/media/profile/scene.png']) assert.ok(html.includes(text), text)
  assert.ok(html.indexOf('我的文字') < html.indexOf('自选数据'))
  for (const query of ['自定义值', '测试角色', '测试画面', '视频链接说明']) {
    assert.ok(searchSite(getSiteSearchEntries(configured), query).some(entry => entry.href === '#game-showcase'), query)
  }
})

test('unsafe custom content is escaped and unusable blocks, media and duplicate IDs stay hidden', () => {
  const configured = { ...site, socials: [
    { id: 'github', platform: 'other', label: '覆盖账号', href: 'https://example.com/override' },
    { id: 'qq', platform: 'qq', label: 'QQ', handle: '<script>account</script>', href: 'https://name:secret@example.com/' },
  ], interests: [
    { id: 'test', title: '<img src=x onerror=alert(1)>', category: 'anime', href: 'javascript:alert(1)', cover: '../tracker.png' },
    { id: 'test', title: '重复卡片', category: 'anime' },
    { id: 'invalid id', title: '无效锚点', category: 'anime' },
  ], gameProfiles: [{ id: 'test', game: 'other', label: '安全测试', description: '测试内容', blocks: [
    { id: 'empty', kind: 'facts', title: '空数据', items: [{ label: '', value: '1' }] },
    { id: 'links', kind: 'links', title: '无效链接', items: [{ title: '脚本', href: 'javascript:alert(1)' }] },
    { id: 'gallery', kind: 'gallery', title: '无效媒体', items: [{ title: '跟踪图片', src: 'https://tracker.test/a.png' }] },
    { id: 'note', kind: 'notes', title: '<b>标题</b>', text: '<script>content</script>' },
    { id: 'note', kind: 'notes', title: '重复区块', text: '重复内容' },
  ] }] }
  assert.equal(getInterests(configured).length, 1)
  assert.equal(getGameProfiles(configured)[0].blocks.length, 1)
  assert.equal(getSocialLinks(configured).filter(profile => profile.id === 'github').length, 1)
  const html = renderStaticSite(configured)
  for (const forbidden of ['javascript:', 'tracker.test', 'name:secret', '<script>content</script>', '<script>account</script>', '<img src=x', '重复卡片', '重复区块', '空数据', '无效链接', '无效媒体', '覆盖账号']) assert.ok(!html.includes(forbidden), forbidden)
  for (const escaped of ['&lt;script&gt;content&lt;/script&gt;', '&lt;script&gt;account&lt;/script&gt;', '&lt;b&gt;标题&lt;/b&gt;']) assert.ok(html.includes(escaped), escaped)
})
