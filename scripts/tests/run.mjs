import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const directory = new URL('./', import.meta.url)
const files = readdirSync(directory, { withFileTypes: true })
  .filter(entry => entry.isFile() && /^test_.*\.mjs$/.test(entry.name))
  .map(entry => fileURLToPath(new URL(entry.name, directory))).sort()
if (!files.length) throw new Error('No repository Node tests discovered')
// Current and retained historical behavior checks run together; new test_ files
// cannot silently miss CI because a long package.json registration was omitted.
const result = spawnSync(process.execPath, ['--test', '--test-isolation=none', ...process.argv.slice(2), ...files], {
  cwd: fileURLToPath(new URL('../../', directory)), stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
