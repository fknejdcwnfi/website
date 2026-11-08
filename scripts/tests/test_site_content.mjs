import assert from 'node:assert/strict'
import test from 'node:test'
import { site, getProjects, getSiteGithub, getSiteRepository, getInterests, resolveProfileAsset, getGameProfiles, getSiteNavigation, getSocialLinks, getSiteSearchEntries, getTableOfContents, searchSite } from '../../src/features/profile/content/site.ts'
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

test('project selectors reject invalid targets and duplicate IDs before display or search', () => {
  const project = site.projects[0]
  const configured = { ...site, projects: [
    project, { ...project, title: 'Duplicate title' },
    { ...project, id: 'invalid target', href: 'https://example.com/' },
    { ...project, id: 'unsafe-link', href: 'javascript:alert(1)' },
    { ...project, id: 'credentials', href: 'https://name:secret@example.com/' },
    { ...project, id: 'invalid-status', status: 'unknown' },
    { ...project, id: 'empty-title', title: ' ' },
  ] }
  assert.deepEqual(getProjects(configured).map(item => item.id), ['living-portrait'])
  const html = renderStaticSite(configured)
  assert.ok(!html.includes('javascript:') && !html.includes('name:secret'))
  assert.ok(!html.includes('Duplicate title') && !html.includes('project-invalid'))
  assert.equal(getSiteSearchEntries(configured).filter(entry => entry.href.startsWith('#project-')).length, 1)
})

test('optional project facts are bounded, escaped and indexed from the same source', () => {
  const project = site.projects[0]
  const configured = { ...site, projects: [{ ...project, kind: '<script>kind</script>', year: 2101,
    tags: [' ', ...Array.from({ length: 10 }, (_, i) => `${i}${'t'.repeat(40)}`)],
    highlights: [' ', '  <img src=x onerror=alert(1)>  ', 'x'.repeat(300), 'x'.repeat(300), 'third', 'fourth', 'fifth'],
    note: '<script>note</script>' + 'n'.repeat(300),
  }] }
  const selected = getProjects(configured)[0]
  assert.equal(selected.year, undefined)
  assert.equal(selected.tags.length, 8)
  assert.ok(selected.tags.every(tag => tag.length <= 32))
  assert.equal(selected.highlights.length, 4)
  assert.ok(selected.highlights.every(item => item.length <= 180))
  assert.equal(selected.note.length, 240)
  const html = renderStaticSite(configured)
  assert.ok(!html.includes('<script>kind') && !html.includes('<script>note') && !html.includes('<img src=x'))
  assert.ok(html.includes('&lt;script&gt;kind&lt;/script&gt;') && html.includes('&lt;img src=x'))
  assert.ok(!html.includes('fifth'))
  assert.deepEqual(searchSite(getSiteSearchEntries(site), '过河').map(entry => entry.id), ['xiangqi-review'])
  const empty = getProjects({ ...site, projects: [{ ...project, kind: ' ', year: 2026.5, highlights: [], note: ' ' }] })[0]
  assert.equal(empty.kind, undefined)
  assert.equal(empty.year, undefined)
  assert.deepEqual(empty.highlights, [])
  assert.equal(empty.note, undefined)
})

test('project overview and native details remain accurate without JavaScript', () => {
  const html = renderStaticSite(site)
  assert.ok(html.includes('<dt>公开项目</dt><dd>2<span> 个</span></dd>'))
  assert.ok(html.includes('<dt>持续制作</dt><dd>1<span> 个</span></dd>'))
  assert.ok(html.includes('<dt>已归档</dt><dd>1<span> 个</span></dd>'))
  assert.equal((html.match(/<details class="personal-project__details">/g) ?? []).length, 2)
  for (const project of getProjects(site)) {
    const row = html.match(new RegExp(`<tr class="personal-project" id="project-${project.id}"[\\s\\S]*?</tr>`))?.[0]
    assert.ok(row)
    assert.equal((row.match(/<a /g) ?? []).length, 1)
    assert.ok(row.includes(`href="${project.href}"`))
    assert.ok(row.includes('<summary><span>项目亮点</span>'))
    for (const highlight of project.highlights) assert.ok(row.includes(escapeHtml(highlight)))
  }
  const single = renderStaticSite({ ...site, projects: [{ ...site.projects[0], kind: undefined, year: undefined, highlights: [], note: undefined }] })
  assert.ok(single.includes('<dt>公开项目</dt><dd>1<span> 个</span></dd>'))
  assert.ok(single.includes('<dt>已归档</dt><dd>0<span> 个</span></dd>'))
  assert.ok(!single.includes('class="personal-project__details"') && !single.includes('class="personal-project__meta"'))
})

test('malformed runtime project records cannot crash display or indexing', () => {
  for (const projects of [null, false, 42, 'projects', {}]) {
    assert.deepEqual(getProjects({ ...site, projects }), [])
  }
  const configured = { ...site, projects: [null, false, [], 42,
    { ...site.projects[0], id: null }, { ...site.projects[0], title: 42 },
    { ...site.projects[0], tags: ['  TypeScript  ', null, 42, 'TypeScript', 'React'],
      kind: 42, highlights: [' first ', null, false, 'first', 'second'], note: {}, year: '2026' },
  ] }
  const projects = getProjects(configured)
  assert.equal(projects.length, 1)
  assert.deepEqual(projects[0].tags, ['TypeScript', 'React'])
  assert.deepEqual(projects[0].highlights, ['first', 'second'])
  for (const field of ['kind', 'year', 'note']) assert.equal(projects[0][field], undefined)
  assert.doesNotThrow(() => renderStaticSite(configured))
  assert.equal(getSiteSearchEntries(configured).filter(entry => entry.href.startsWith('#project-')).length, 1)
  const missingLists = getProjects({ ...site, projects: [{ ...site.projects[0], tags: null, highlights: {} }] })[0]
  assert.deepEqual(missingLists.tags, [])
  assert.deepEqual(missingLists.highlights, [])
})

test('malformed optional profile records retain only valid members and omit unusable data', () => {
  for (const value of [null, false, 42, 'records', {}]) {
    const configured = { ...site, socials: value, interests: value, gameProfiles: value }
    assert.deepEqual(getInterests(configured), [])
    assert.deepEqual(getGameProfiles(configured), [])
    assert.deepEqual(getSocialLinks(configured).map(profile => profile.id), ['github', 'email'])
    assert.doesNotThrow(() => renderStaticSite(configured))
  }
  const configured = { ...site,
    socials: [null, false, [], { id: 'invalid', label: 42, handle: 'no' },
      { id: 'good', label: ' Good ', platform: 'unsupported', handle: ' public-name ', description: 42, qrCode: {}, href: [] },
      { id: 'empty', label: 'Empty', platform: 'other', handle: 42, href: 'javascript:alert(1)' }],
    interests: [null, false, [], { id: 'invalid', title: 42 },
      { id: 'good', title: ' Good ', category: 'unsupported', tags: [' a ', null, 42, 'a', 'b'],
        favorites: [' f ', {}, 'f'], description: false, note: 42, href: [], cover: {} }],
    gameProfiles: [null, false, [], { id: 'invalid', label: 42 },
      { id: 'good', label: ' Good ', game: 'unsupported', tags: [' team ', null, 42], description: 42,
        playerName: false, playerId: [], region: {}, blocks: [null, false, [],
          { id: 'invalid', kind: 'notes', title: 42, text: 'hidden' },
          { id: 'bad-items', kind: 'facts', title: 'Bad items', items: null },
          { id: 'notes', kind: 'notes', title: ' Notes ', text: ' Real text ', expanded: true },
          { id: 'facts', kind: 'facts', title: 'Facts', items: [null, false, {},
            { label: ' Region ', value: ' Public ' }, { label: 'bad', value: 42 }] },
          { id: 'links', kind: 'links', title: 'Links', items: [{ title: 'Bad', href: 'javascript:alert(1)' }] },
          { id: 'gallery', kind: 'gallery', title: 'Gallery', items: [{ title: 'Bad', src: 'https://example.com/tracker.png' }] },
        ] }],
  }
  const profiles = getSocialLinks(configured)
  assert.deepEqual(profiles.map(profile => profile.id), ['github', 'email', 'good'])
  assert.equal(profiles[2].platform, 'other')
  assert.equal(profiles[2].handle, 'public-name')
  assert.equal(profiles[2].description, undefined)
  assert.equal(profiles[2].href, undefined)
  assert.equal(profiles[2].qrCode, undefined)
  const interests = getInterests(configured)
  assert.equal(interests.length, 1)
  assert.equal(interests[0].category, 'other')
  assert.deepEqual(interests[0].tags, ['a', 'b'])
  assert.deepEqual(interests[0].favorites, ['f'])
  for (const field of ['description', 'note', 'href', 'cover']) assert.equal(interests[0][field], undefined)
  const games = getGameProfiles(configured)
  assert.equal(games.length, 1)
  assert.equal(games[0].game, 'other')
  assert.deepEqual(games[0].tags, ['team'])
  for (const field of ['description', 'playerName', 'playerId', 'region']) assert.equal(games[0][field], undefined)
  assert.deepEqual(games[0].blocks.map(block => block.id), ['notes', 'facts'])
  assert.equal(games[0].blocks[0].text, 'Real text')
  assert.equal(games[0].blocks[0].expanded, true)
  assert.deepEqual(games[0].blocks[1].items, [{ label: 'Region', value: 'Public' }])
  const html = renderStaticSite(configured)
  assert.ok(!html.includes('javascript:') && !html.includes('tracker.png') && !html.includes('[object Object]'))
  assert.ok(searchSite(getSiteSearchEntries(configured), 'Real text').some(entry => entry.href === '#game-good'))
})

test('top-level GitHub URLs are validated before every static link is derived', () => {
  const invalid = [undefined, null, 42, {}, '', 'javascript:alert(1)', 'data:text/html,bad',
    'http://github.com/owner', 'https://evil.example/owner', 'https://github.com.evil.example/owner',
    'https://name:secret@github.com/owner', 'https://github.com:444/owner',
    'https://github.com/', 'https://github.com/owner/repository']
  for (const github of invalid) {
    const configured = { ...site, github }
    assert.equal(getSiteGithub(configured), undefined, String(github))
    assert.equal(getSiteRepository(configured), undefined, String(github))
    assert.ok(!getSocialLinks(configured).some(profile => profile.id === 'github'))
    const html = renderStaticSite(configured)
    const links = [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1])
    assert.ok(links.every(href => href.startsWith('#') || href.startsWith('https://') || href.startsWith('mailto:')), String(github))
    assert.ok(!links.some(href => href.includes('evil.example') || href.includes('name:secret') ||
      href.includes('[object Object]') || href === 'undefined/website' || href === '/website'), String(github))
    assert.ok(!html.includes('class="repository-link"') && !html.includes('class="site-toc__source"'), String(github))
  }
  const canonical = { ...site, github: ' https://github.com/Valid-Owner/?tab=repositories#profile ' }
  assert.equal(getSiteGithub(canonical), 'https://github.com/Valid-Owner')
  assert.equal(getSiteRepository(canonical), 'https://github.com/Valid-Owner/website')
  assert.equal(getSocialLinks(canonical).find(profile => profile.id === 'github').href, 'https://github.com/Valid-Owner')
  assert.ok(renderStaticSite(canonical).includes('href="https://github.com/Valid-Owner/website"'))
})

test('navigation only exposes unique actual local section targets', () => {
  const configured = { ...site, interests: [], gameProfiles: [], navigation: [
    null, false, [], { label: 'Unsafe', href: 'javascript:alert(1)' },
    { label: 'External', href: 'https://example.com/' }, { label: 'Missing', href: '#missing' },
    { label: 'Not configured', href: '#games' }, { label: 'Not configured', href: '#interests' },
    { label: ' Home ', href: '#home' }, { label: 'Duplicate', href: '#home' },
    { label: ' ', href: '#about' }, { label: ' Works ', href: '#work' }, { label: 42, href: '#contact' },
  ] }
  assert.deepEqual(getSiteNavigation(configured), [{ label: 'Home', href: '#home' }, { label: 'Works', href: '#work' }])
  const html = renderStaticSite(configured)
  assert.ok(!html.includes('javascript:') && !html.includes('href="#missing"') && !html.includes('href="https://example.com/"'))
  for (const navigation of [null, false, 42, 'navigation', {}]) {
    assert.deepEqual(getSiteNavigation({ ...configured, navigation }), [])
  }
  const defaults = getSiteNavigation(site)
  assert.deepEqual(defaults.map(link => link.href), ['#home', '#about', '#work', '#interests', '#games', '#contact'])
})

test('React shell and project components omit unsafe configuration just like static HTML', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({ root: process.cwd(), logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null } })
  let configuredSite
  let saved
  try {
    const content = await server.ssrLoadModule('/src/features/profile/content/site.ts')
    const { default: SiteShell } = await server.ssrLoadModule('/src/features/profile/components/SiteShell.tsx')
    const { default: PersonalSections } = await server.ssrLoadModule('/src/features/profile/components/PersonalSections.tsx')
    configuredSite = content.site
    saved = { github: configuredSite.github, navigation: configuredSite.navigation }
    configuredSite.github = 'javascript:alert(1)'
    configuredSite.navigation = [{ label: 'Unsafe', href: 'javascript:alert(1)' },
      { label: 'Missing', href: '#missing' }, { label: 'Home', href: '#home' }]
    const html = renderToStaticMarkup(createElement(SiteShell, null, createElement(PersonalSections)))
    const links = [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1])
    assert.ok(!links.some(href => href.startsWith('javascript:') || href.includes('#missing')))
    assert.ok(!html.includes('class="repository-link"') && !html.includes('class="site-toc__source"'))
    assert.ok(!html.includes('href="undefined') && !html.includes('href="/website"'))
    assert.ok(html.includes('id="project-living-portrait"') && html.includes('id="project-xiangqi-review"'))
    assert.ok(html.includes('href="https://github.com/fknejdcwnfi/website"') &&
      html.includes('href="https://github.com/fknejdcwnfi/xiangqi-review"'))
  } finally {
    if (configuredSite && saved) Object.assign(configuredSite, saved)
    await server.close()
  }
  assert.equal(site.github, 'https://github.com/fknejdcwnfi')
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
