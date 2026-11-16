import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { CARD_DECORATION_SIZES, GAME_DECORATION, WIDE_DECORATION_SIZES, getDecorationSrcSet, getInterestDecoration, getSocialDecoration } from '../../src/features/profile/content/decorativeAssets.ts'
import { site } from '../../src/features/profile/content/site.ts'
import { renderStaticSite } from '../../src/features/profile/content/staticMarkup.ts'

const root = new URL('../../', import.meta.url)
const decorations = [getInterestDecoration('naruto'), getInterestDecoration('detective-conan'), GAME_DECORATION,
  getSocialDecoration('github'), getSocialDecoration('email')]

test('responsive candidates match the verified source/variant manifest in both hosting bases', () => {
  const manifest = JSON.parse(readFileSync(new URL('public/assets/pixel-ui/responsive-manifest.json', root), 'utf8'))
  assert.equal(manifest.images.length, 5)
  assert.equal(manifest.allOriginalPixelsRetainedInVariants, false)
  for (const decoration of decorations) {
    const entry = manifest.images.find(entry => entry.source === decoration.file)
    assert.ok(entry)
    assert.equal(entry.width, decoration.width)
    assert.equal(entry.height, decoration.height)
    for (const base of ['/', '/website/']) {
      const candidates = getDecorationSrcSet(decoration, base).split(', ')
      assert.deepEqual(candidates, [
        ...entry.variants.map(variant => `${base}assets/pixel-ui/${variant.file} ${variant.width}w`),
        `${base}assets/pixel-ui/${entry.source} ${entry.width}w`,
      ])
    }
  }
})

test('static decoration keeps full fallbacks, intrinsic dimensions and accessible lazy semantics', () => {
  const html = renderStaticSite(site, '/website/')
  const images = [...html.matchAll(/<img\s[^>]*>/g)].map(match => match[0]).filter(image => image.includes('srcset='))
  assert.equal(images.length, 5)
  for (const decoration of decorations) {
    const image = images.find(image => image.includes(`src="/website/assets/pixel-ui/${decoration.file}"`))
    assert.ok(image)
    assert.ok(image.includes(`width="${decoration.width}"`) && image.includes(`height="${decoration.height}"`))
    assert.ok(image.includes('loading="lazy"') && image.includes('decoding="async"'))
    assert.ok(image.includes('alt=""') && image.includes('aria-hidden="true"'))
    assert.ok(image.includes(`srcset="${getDecorationSrcSet(decoration, '/website/')}"`))
    assert.ok(image.includes(`sizes="${decoration === GAME_DECORATION ? WIDE_DECORATION_SIZES : CARD_DECORATION_SIZES}"`))
  }
  assert.ok(!images.some(image => image.includes('twilight-world') || image.includes('poetic-pixel')))
})

test('React and no-JS markup use identical responsive candidates without touching optional covers', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({ root: process.cwd(), logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null } })
  try {
    const modules = await server.ssrLoadModule('/src/features/profile/components/ProfileModules.tsx')
    const jsx = [modules.InterestSection, modules.GameSection, modules.SocialSection]
      .map(component => renderToStaticMarkup(createElement(component, { content: site, base: '/website/' }))).join('')
    const html = renderStaticSite(site, '/website/')
    const candidates = markup => [...markup.matchAll(/<img\s[^>]*>/g)].map(match => match[0])
      .filter(image => /\ssrc[Ss]et=/.test(image)).map(image => ({
        src: image.match(/\ssrc="([^"]+)"/)?.[1],
        srcset: image.match(/\ssrc[Ss]et="([^"]+)"/)?.[1],
        sizes: image.match(/\ssizes="([^"]+)"/)?.[1],
      })).sort((a, b) => a.src.localeCompare(b.src))
    assert.equal(candidates(jsx).length, 5)
    assert.deepEqual(candidates(jsx), candidates(html))
    const coverSite = { ...site, interests: [{ ...site.interests[0], cover: 'media/local-cover.png' }] }
    const covered = renderToStaticMarkup(createElement(modules.InterestSection, { content: coverSite, base: '/website/' }))
    assert.ok(covered.includes('src="/website/media/local-cover.png"'))
    assert.ok(!covered.includes('srcSet=') && !covered.includes('srcset='))
  } finally {
    await server.close()
  }
})
