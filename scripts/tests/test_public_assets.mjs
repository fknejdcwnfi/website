import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { readPublicInventory, verifyPublicDirectory, verifyBuiltDirectory } from '../build/publicAssets.ts'

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

test('only explicit safe reviewed public paths are accepted', () => fixture(({ root }) => {
  const manifest = join(root, 'inventory.json')
  const read = value => { writeFileSync(manifest, JSON.stringify(value)); return () => readPublicInventory(manifest) }
  assert.deepEqual(read({ version: 1, files: ['media/tile.webp'] })(), ['media/tile.webp'])
  for (const value of [null, [], {}, { version: 2, files: ['media/tile.webp'] }, { version: 1, files: [] },
    { version: 1, files: ['media/tile.webp', 'media/tile.webp'] }]) assert.throws(read(value))
  for (const name of ['.env', 'media/.env.local', 'credentials.json', 'secrets.txt', 'id_rsa', 'media/original.docx',
    'assets/portrait-rig/unknown.bin',
    'media/archive.zip', 'media/notes.md', 'media/debug.js.map', '../outside.webp', 'media//tile.webp',
    '/media/tile.webp', 'media/./tile.webp', 'media/../tile.webp', 'media\\tile.webp', 'media/encoded%2fpath.webp']) {
    assert.throws(read({ version: 1, files: [name] }), undefined, name)
  }
}))

test('the actual reviewed public inventory includes only existing safe resources', () => {
  const reviewed = readPublicInventory(fileURLToPath(new URL('../../config/public-assets.json', import.meta.url)))
  verifyPublicDirectory(fileURLToPath(new URL('../../public/', import.meta.url)), reviewed)
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
  verifyBuiltDirectory(outputRoot, publicRoot, reviewed, generated)
  writeFileSync(join(outputRoot, 'assets', 'stale-old.js'), 'stale code')
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, reviewed, generated), /inventory mismatch/)
  rmSync(join(outputRoot, 'assets', 'stale-old.js'))
  writeFileSync(join(outputRoot, 'media', 'tile.webp'), 'changed bytes')
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, reviewed, generated), /differs/)
  writeFileSync(join(outputRoot, 'media', 'tile.webp'), readFileSync(join(publicRoot, 'media', 'tile.webp')))
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, reviewed, ['assets/app-test.js']), /inventory/)
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, reviewed, [...generated, 'assets/original.docx']), /file type/)
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, reviewed, [...generated, 'notes.html']), /publication path/)
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, reviewed, [...generated, '../outside.js']), /publication path/)
}))

test('a generated output cannot shadow a reviewed public asset or use a link', () => fixture(({ publicRoot, outputRoot, reviewed, generated }) => {
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, reviewed, [...generated, 'assets/app-test.js']), /inventory/)
  rmSync(join(outputRoot, 'assets', 'app-test.js'))
  symlinkSync(join(publicRoot, 'media', 'tile.webp'), join(outputRoot, 'assets', 'app-test.js'))
  assert.throws(() => verifyBuiltDirectory(outputRoot, publicRoot, reviewed, generated), /Unsafe build entry/)
}))

test('special filesystem entries are rejected without reading their contents', { skip: process.platform === 'win32' }, () => fixture(async ({ publicRoot, reviewed }) => {
  const socketPath = join(publicRoot, 'media', 'socket.webp')
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve) })
  try { assert.throws(() => verifyPublicDirectory(publicRoot, [...reviewed, 'media/socket.webp']), /Non-regular public entry/) }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}))
