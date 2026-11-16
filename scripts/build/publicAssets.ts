import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

const publicExtensions = new Set([
  '.avif', '.gif', '.ico', '.jpeg', '.jpg', '.json', '.mp4', '.png', '.svg',
  '.ttf', '.txt', '.webm', '.webp', '.woff', '.woff2', '.xml',
])
const generatedExtensions = new Set([...publicExtensions, '.css', '.html', '.js', '.mjs'])
// Retained historical physics data is not an arbitrary binary upload surface.
const retainedDataPaths = new Set([
  'assets/portrait-rig/wind-default-00b40de9dee99ba5.bin',
  'assets/portrait-rig/wind-default-603c3aa881386fd1.bin',
  'assets/portrait-rig/wind-default-ef4aaf78bc5aeca9.bin',
])
const sensitiveName = /^(?:credentials?|secrets?|id_(?:rsa|dsa|ecdsa|ed25519))(?:\..*)?$/i

const canonicalPath = (value: unknown): value is string => typeof value === 'string' &&
  /^[a-z0-9][a-z0-9._/-]*$/i.test(value) &&
  value.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.'))

const checkPath = (name: string, generated = false): void => {
  if (!canonicalPath(name) || name.split('/').some(part => sensitiveName.test(part))) {
    throw new Error(`Unsafe publication path: ${name}`)
  }
  const extension = extname(name).toLowerCase()
  if (!(generated ? generatedExtensions : publicExtensions).has(extension) &&
    (generated || !retainedDataPaths.has(name))) {
    throw new Error(`Unsupported publication file type: ${name}`)
  }
  if (generated && (extension === '.html' ? name !== 'index.html' : !name.startsWith('assets/'))) {
    throw new Error(`Unexpected generated publication path: ${name}`)
  }
}

/** A reviewed path list, never a build-time discovery/authorization mechanism. */
export const readPublicInventory = (manifestPath: string): string[] => {
  const inventory: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
    throw new Error('Invalid public asset inventory.')
  }
  const { version, files } = inventory as { version?: unknown; files?: unknown }
  if (version !== 1 || !Array.isArray(files) || !files.length || files.some(file => !canonicalPath(file))) {
    throw new Error('Invalid public asset inventory.')
  }
  for (const file of files) checkPath(file)
  if (new Set(files).size !== files.length) throw new Error('Duplicate public asset inventory path.')
  return [...files]
}

const directoriesFor = (files: readonly string[]): Set<string> => {
  const directories = new Set([''])
  for (const file of files) {
    let directory = dirname(file).split(sep).join('/')
    while (directory !== '.') {
      directories.add(directory)
      directory = dirname(directory).split(sep).join('/')
    }
  }
  return directories
}

/** Reject links and special files before opening any asset contents. */
const regularFiles = (root: string, expected: readonly string[], label: string): string[] => {
  const rootInfo = lstatSync(root)
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error(`Invalid ${label} directory.`)
  const directories = directoriesFor(expected)
  const files: string[] = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry)
      const name = relative(root, path).split(sep).join('/')
      const info = lstatSync(path)
      if (!canonicalPath(name) || info.isSymbolicLink()) throw new Error(`Unsafe ${label} entry: ${name}`)
      if (info.isDirectory()) {
        if (!directories.has(name)) throw new Error(`Unexpected ${label} directory: ${name}`)
        walk(path)
      } else if (info.isFile()) files.push(name)
      else throw new Error(`Non-regular ${label} entry: ${name}`)
    }
  }
  walk(root)
  return files
}

const exactFiles = (actual: readonly string[], expected: readonly string[], label: string): void => {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  const unexpected = actual.filter(file => !expectedSet.has(file))
  const missing = expected.filter(file => !actualSet.has(file))
  if (unexpected.length || missing.length) {
    throw new Error(`${label} inventory mismatch: unexpected [${unexpected.join(', ')}]; missing [${missing.join(', ')}].`)
  }
}

export const verifyPublicDirectory = (publicRoot: string, reviewed: readonly string[]): void => {
  for (const file of reviewed) checkPath(file)
  const actual = regularFiles(publicRoot, reviewed, 'public')
  for (const file of actual) checkPath(file)
  exactFiles(actual, reviewed, 'Public')
}

/** Only Vite's declared outputs and the reviewed public files may be published. */
export const verifyBuiltDirectory = (
  outputRoot: string, publicRoot: string, reviewed: readonly string[], generated: readonly string[],
): void => {
  verifyPublicDirectory(publicRoot, reviewed)
  for (const file of generated) checkPath(file, true)
  if (!generated.includes('index.html') || new Set(generated).size !== generated.length ||
    generated.some(file => reviewed.includes(file))) {
    throw new Error('Invalid or colliding generated publication inventory.')
  }
  const expected = [...reviewed, ...generated]
  exactFiles(regularFiles(outputRoot, expected, 'build'), expected, 'Build')
  for (const file of reviewed) {
    if (!readFileSync(resolve(publicRoot, file)).equals(readFileSync(resolve(outputRoot, file)))) {
      throw new Error(`Published public asset differs from its reviewed source: ${file}`)
    }
  }
}

/** Build-only guard; local development never authorizes new public files. */
export const publicAssetsGuard = (): Plugin => {
  let config: ResolvedConfig
  let reviewed: string[] = []
  return {
    name: 'reviewed-publication-assets',
    apply: 'build',
    configResolved(resolved) { config = resolved },
    buildStart() {
      if (!config.publicDir) throw new Error('The publication guard requires the configured public directory.')
      reviewed = readPublicInventory(resolve(config.root, 'config/public-assets.json'))
      verifyPublicDirectory(config.publicDir, reviewed)
    },
    writeBundle(options, bundle) {
      if (!options.dir || options.file) throw new Error('The publication guard requires directory output.')
      const output = isAbsolute(options.dir) ? options.dir : resolve(config.root, options.dir)
      verifyBuiltDirectory(output, config.publicDir, reviewed, Object.values(bundle).map(file => file.fileName))
    },
  }
}
