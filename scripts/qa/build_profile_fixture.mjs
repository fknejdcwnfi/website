/** Build an isolated production-like fixture without editing public content or dist/. */
import { build, loadConfigFromFile } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'
import { profileFixture } from './fixtures/profile_modules.mjs'
import { site } from '../../src/features/profile/content/site.ts'
import { renderStaticSite } from '../../src/features/profile/content/staticMarkup.ts'

const root = resolve(import.meta.dirname, '../..')
const output = resolve(root, 'work/profile-fixture-dist/website')
if (!output.startsWith(resolve(root, 'work') + '/')) throw Error('QA output must stay under ignored work/.')
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, resolve(root, 'vite.config.ts'))
if (!loaded) throw Error('Could not load the real production configuration.')
const fixture = { ...site, ...profileFixture }
const injector = {
  name: 'qa-isolated-profile-fixture', enforce: 'pre',
  transform(code, id) {
    return id.split('?')[0] === resolve(root, 'src/features/profile/content/site.ts')
      ? { code: `${code}\nObject.assign(site, ${JSON.stringify(profileFixture)});\n`, map: null } : undefined
  },
  transformIndexHtml: { order: 'pre', handler(html) {
    return html.replace('<!--site-fallback-->', renderStaticSite(fixture, '%BASE_URL%'))
  } },
}
await build({ ...loaded.config, configFile: false, root, base: '/website/',
  plugins: [injector, ...(loaded.config.plugins ?? [])],
  build: { ...loaded.config.build, outDir: output, emptyOutDir: true } })

// A tiny geometric image tests local loading/layout. It is not a functional QR code.
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1
  return value >>> 0
})
const crc32 = data => { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0 }
const chunk = (name, data) => {
  const type = Buffer.from(name), size = Buffer.alloc(4), checksum = Buffer.alloc(4)
  size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])))
  return Buffer.concat([size, type, data, checksum])
}
const side = 240, raw = Buffer.alloc(side * (1 + side * 3))
for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
  const at = y * (1 + side * 3) + 1 + x * 3, dark = (Math.floor(x / 20) + Math.floor(y / 20)) % 2
  raw[at] = dark ? 52 : 233; raw[at + 1] = dark ? 83 : 236; raw[at + 2] = dark ? 62 : 225
}
const header = Buffer.alloc(13); header.writeUInt32BE(side); header.writeUInt32BE(side, 4); header[8] = 8; header[9] = 2
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
await mkdir(resolve(output, 'qa-profile'), { recursive: true })
await writeFile(resolve(output, 'qa-profile/media-test.png'), png)
await writeFile(resolve(output, '.qa-fixture.json'), JSON.stringify({ syntheticOnly: true, productionContentChanged: false, fixture: profileFixture }, null, 2) + '\n')
process.stdout.write(`Isolated fixture built: ${output}\n`)
