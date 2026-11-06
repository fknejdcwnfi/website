import type { SceneAssets, SceneDefinition, SceneImageSource } from './types'

const abortError = (): DOMException => new DOMException('Scene loading was cancelled.', 'AbortError')

const loadImage = (source: SceneImageSource, signal: AbortSignal): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(abortError()); return }
  const image = new Image()
  const cleanup = (): void => {
    image.onload = null
    image.onerror = null
    signal.removeEventListener('abort', cancel)
  }
  const cancel = (): void => { cleanup(); image.removeAttribute('src'); reject(abortError()) }
  signal.addEventListener('abort', cancel, { once: true })
  image.onerror = (): void => { cleanup(); reject(new Error('Scene artwork could not be loaded.')) }
  image.onload = (): void => {
    cleanup()
    if (image.naturalWidth !== source.width || image.naturalHeight !== source.height) {
      reject(new Error('Scene artwork does not match its authored dimensions.')); return
    }
    resolve(image)
  }
  image.src = source.src
})

const checkImage = (image: SceneImageSource): void => {
  if (!image || typeof image.src !== 'string' || !image.src.length ||
    !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
    image.width < 1 || image.height < 1 || image.width > 8192 || image.height > 8192) {
    throw new Error('Invalid scene image description.')
  }
  const url = new URL(image.src, window.location.href)
  if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Scene artwork must use a local site asset.')
  }
}

export const loadSceneAssets = async (definition: SceneDefinition, signal: AbortSignal): Promise<SceneAssets> => {
  if (definition.version !== 1 || !Number.isInteger(definition.width) || !Number.isInteger(definition.height) ||
    definition.width < 1 || definition.height < 1 || definition.width > 4096 || definition.height > 4096 ||
    definition.width * definition.height > 8_388_608 ||
    typeof definition.description !== 'string' || !definition.description.length ||
    definition.canonical.width * definition.height !== definition.canonical.height * definition.width) {
    throw new Error('Unsupported reference scene.')
  }
  checkImage(definition.canonical)
  const entries = Object.entries(definition.layers ?? {})
  if (entries.length > 40 || entries.some(([name]) => !/^[a-z][a-z0-9-]{0,79}$/.test(name))) throw new Error('Invalid scene layer inventory.')
  for (const [, source] of entries) checkImage(source)
  const [canonical, layers] = await Promise.all([
    loadImage(definition.canonical, signal),
    Promise.all(entries.map(async ([name, source]) => [name, await loadImage(source, signal)] as const)),
  ])
  return { definition, canonical, layers: Object.fromEntries(layers) }
}
