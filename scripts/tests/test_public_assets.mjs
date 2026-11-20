import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { readPublicInventory, verifyPublicDirectory, verifyBuiltDirectory, verifyPublishedReferences } from '../build/publicAssets.ts'

const fixture = async run => {
  const root = mkdtempSync(join(tmpdir(), 'public-assets-'))
  const publicRoot = join(root, 'public'), outputRoot = join(root, 'dist')
  mkdirSync(join(publicRoot, 'media'), { recursive: true })
  mkdirSync(join(outputRoot, 'media'), { recursive: true })
  mkdirSync(join(outputRoot, 'assets'))
  for (const directory of [publicRoot, outputRoot]) writeFileSync(join(directory, 'media', 'tile.webp'), 'synthetic image bytes')
  writeFileSync(join(outputRoot, 'index.html'), '<!doctype html><html></html>')
  writeFileSync(join(outputRoot, 'assets', 'app-test.js'), 'export {}')
  try { return await run({ root, publicRoot, outputRoot, reviewed: ['media/tile.webp'], generated: ['index.html', 'assets/app-test.js'] }) }
  finally { rmSync(root, { recursive: true, force: true }) }
}

test('the inventory classifies safe reviewed paths without overlap', () => fixture(({ root }) => {
  const manifest = join(root, 'inventory.json')
  const read = value => { writeFileSync(manifest, JSON.stringify(value)); return () => readPublicInventory(manifest) }
  const inventory = { files: ['media/tile.webp'], developmentOnly: ['historical/atlas.png'] }
  assert.deepEqual(read({ version: 2, ...inventory })(), inventory)
  for (const value of [null, [], {}, { version: 1, ...inventory }, { version: 2, files: inventory.files },
    { version: 2, ...inventory, files: [] }, { version: 2, ...inventory, files: ['media/tile.webp', 'media/tile.webp'] },
    { version: 2, ...inventory, developmentOnly: ['Media/Tile.webp'] }]) assert.throws(read(value))
  for (const name of ['.env', 'media/.env.local', 'credentials.json', 'secrets.txt', 'id_rsa', 'media/original.docx',
    'assets/portrait-rig/unknown.bin',
    'media/archive.zip', 'media/notes.md', 'media/debug.js.map', '../outside.webp', 'media//tile.webp',
    '/media/tile.webp', 'media/./tile.webp', 'media/../tile.webp', 'media\\tile.webp', 'media/encoded%2fpath.webp']) {
    assert.throws(read({ version: 2, files: [name], developmentOnly: [] }), undefined, name)
    assert.throws(read({ version: 2, files: inventory.files, developmentOnly: [name] }), undefined, name)
  }
}))

test('the actual reviewed public inventory includes only existing safe resources', () => {
  const inventory = readPublicInventory(fileURLToPath(new URL('../../config/public-assets.json', import.meta.url)))
  verifyPublicDirectory(fileURLToPath(new URL('../../public/', import.meta.url)), [...inventory.files, ...inventory.developmentOnly])
})

test('unreviewed files and directories fail even with an otherwise safe extension', () => fixture(({ publicRoot, reviewed }) => {
  verifyPublicDirectory(publicRoot, reviewed)
  writeFileSync(join(publicRoot, 'unreviewed.json'), '{}')
  assert.throws(() => verifyPublicDirectory(publicRoot, reviewed), /inventory mismatch/)
  rmSync(join(publicRoot, 'unreviewed.json'))
  mkdirSync(join(publicRoot, 'unused'))
  assert.throws(() => verifyPublicDirectory(publicRoot, reviewed), /Unexpected public directory/)
  rmSync(join(publicRoot, 'unused'), { recursive: true })
  rmSync(join(publicRoot, 'media', 'tile.webp'))
  assert.throws(() => verifyPublicDirectory(publicRoot, reviewed), /missing/)
}))

test('symlinks cannot publish files or directories outside the reviewed tree', () => fixture(({ root, publicRoot, reviewed }) => {
  const external = join(root, 'external.webp')
  writeFileSync(external, 'private synthetic fixture')
  rmSync(join(publicRoot, 'media', 'tile.webp'))
  symlinkSync(external, join(publicRoot, 'media', 'tile.webp'))
  assert.throws(() => verifyPublicDirectory(publicRoot, reviewed), /Unsafe public entry/)
  rmSync(join(publicRoot, 'media', 'tile.webp'))
  rmSync(join(publicRoot, 'media'), { recursive: true })
  symlinkSync(root, join(publicRoot, 'media'), 'dir')
  assert.throws(() => verifyPublicDirectory(publicRoot, reviewed), /Unsafe public entry/)
}))

test('the build contains exactly declared generated files and unchanged public bytes', () => fixture(({ publicRoot, outputRoot, reviewed, generated }) => {
  const inventory = { files: reviewed, developmentOnly: [] }
  verifyBuiltDirectory(outputRoot, publicRoot, inventory, generated)
  writeFileSync(join(outputRoot, 'assets', 'stale-old.js'), 'stale code')
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, generated), /inventory mismatch/)
  rmSync(join(outputRoot, 'assets', 'stale-old.js'))
  writeFileSync(join(outputRoot, 'media', 'tile.webp'), 'changed bytes')
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, generated), /differs/)
  writeFileSync(join(outputRoot, 'media', 'tile.webp'), readFileSync(join(publicRoot, 'media', 'tile.webp')))
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, ['assets/app-test.js']), /inventory/)
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, [...generated, 'assets/original.docx']), /file type/)
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, [...generated, 'notes.html']), /publication path/)
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, [...generated, '../outside.js']), /publication path/)
}))

test('a generated output cannot shadow a reviewed public asset or use a link', () => fixture(({ publicRoot, outputRoot, reviewed, generated }) => {
  const inventory = { files: reviewed, developmentOnly: [] }
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, [...generated, 'assets/app-test.js']), /inventory/)
  rmSync(join(outputRoot, 'assets', 'app-test.js'))
  symlinkSync(join(publicRoot, 'media', 'tile.webp'), join(outputRoot, 'assets', 'app-test.js'))
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, generated), /Unsafe build entry/)
}))

test('historical source assets are required locally and forbidden in production', () => fixture(({ publicRoot, outputRoot, reviewed, generated }) => {
  const inventory = { files: reviewed, developmentOnly: ['assets/old.webp'] }
  const original = join(publicRoot, 'assets', 'old.webp')
  mkdirSync(join(publicRoot, 'assets'))
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, generated), /missing/)
  writeFileSync(original, 'historical fixture')
  verifyBuiltDirectory(outputRoot, publicRoot, inventory, generated)
  writeFileSync(join(outputRoot, 'assets', 'old.webp'), 'historical fixture')
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, generated), /inventory mismatch/)
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, inventory, [...generated, 'assets/old.webp']), /colliding/)
}))

test('production code cannot point to a historical asset or its retired directory', () => {
  const inventory = { files: ['assets/live.webp'], developmentOnly: ['assets/old.webp', 'assets/historical/atlas.png'] }
  verifyPublishedReferences('const url = "/assets/live.webp"', inventory, 'app.js')
  for (const source of ['url(/website/assets/old.webp)', 'const base = "/assets/historical/"']) {
    assert.throws(() => verifyPublishedReferences(source, inventory, 'app.js'), /references an unpublished asset/)
  }
})

test('special filesystem entries are rejected without reading their contents', { skip: process.platform === 'win32' }, () => fixture(async ({ publicRoot, reviewed }) => {
  const socketPath = join(publicRoot, 'media', 'socket.webp')
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve) })
  try { assert.throws(() => verifyPublicDirectory(publicRoot, [...reviewed, 'media/socket.webp']), /Non-regular public entry/) }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}))
