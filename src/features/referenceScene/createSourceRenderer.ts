import type { SceneRendererFactory } from './types'
import { validateSourceTiming, sampleSourceTime } from './sourceTiming'
import { sourceAssetManifest, smoothAssetManifest } from './pixelAssets'
import { createPixelScaler } from './pixelArtScale'

/**
 * The bundled descriptor is already versioned with the player. It is the runtime
 * authority; fetching the same timing JSON again would add a serial round trip
 * before the large atlas can even start. Offline verification binds full
 * manifests, authoring scripts and source hashes to these compiled descriptors.
 */
export const createSourceRenderer: SceneRendererFactory = async (assets, signal) => {
  const useOriginal = new URLSearchParams(location.search).get('motion') === 'original'
  const descriptor = useOriginal ? sourceAssetManifest : smoothAssetManifest
  const width = Number(assets.definition.width), height = Number(assets.definition.height)
  const nativeWidth = descriptor.tileWidth, nativeHeight = descriptor.tileHeight
  if (descriptor.version !== 1 || !Number.isInteger(nativeWidth) || !Number.isInteger(nativeHeight) ||
    nativeWidth < 1 || nativeHeight < 1 || descriptor.width !== nativeWidth || descriptor.height !== nativeHeight ||
    !Number.isInteger(descriptor.atlasColumns) || descriptor.atlasColumns < 1 || descriptor.atlasColumns > 32 ||
    !Number.isInteger(descriptor.atlasRows) || descriptor.atlasRows < 1 || descriptor.atlasRows > 32 ||
    descriptor.atlasColumns * descriptor.atlasRows < descriptor.frameCount ||
    descriptor.atlasColumns * nativeWidth > 8192 || descriptor.atlasRows * nativeHeight > 8192 ||
    !((width === nativeWidth && height === nativeHeight) || (width === nativeWidth * 2 && height === nativeHeight * 2))) {
    throw new Error('Invalid reference animation atlas.')
  }
  const timing = validateSourceTiming({ ...descriptor, sourceAnchorCount: sourceAssetManifest.frameCount })
  const base = `${import.meta.env.BASE_URL}assets/reference-scene/`
  const atlas = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.fetchPriority = 'low'
    image.decoding = 'async'
    const finish = (): void => {
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', cancel)
    }
    const cancel = (): void => {
      finish()
      image.removeAttribute('src')
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    if (signal.aborted) { cancel(); return }
    signal.addEventListener('abort', cancel, { once: true })
    image.onload = () => {
      void image.decode().then(() => {
        if (signal.aborted) { cancel(); return }
        finish()
        resolve(image)
      }).catch(() => {
        finish()
        reject(new Error('Reference animation atlas could not be decoded.'))
      })
    }
    image.onerror = () => { finish(); reject(new Error('Reference animation atlas unavailable.')) }
    image.src = `${base}${descriptor.atlas}?v=${descriptor.atlasSha256}`
  })
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  if (atlas.naturalWidth !== descriptor.atlasColumns * nativeWidth || atlas.naturalHeight !== descriptor.atlasRows * nativeHeight) {
    throw new Error('Reference animation atlas does not match its timing.')
  }
  // Request a ready-to-raster bitmap asynchronously. Image.decode() can leave
  // expensive image-source preparation until the first Canvas pixel read.
  let bitmap: ImageBitmap | null = null
  if (typeof createImageBitmap === 'function') {
    try { bitmap = await createImageBitmap(atlas) } catch { /* Native-image fallback remains available. */ }
  }
  if (signal.aborted) { bitmap?.close(); throw new DOMException('Cancelled', 'AbortError') }
  const source: CanvasImageSource = bitmap ?? atlas
  // Only output pixels are reconstructed. Keep the original atlas compact rather
  // than downloading/storing a four-times-larger 160-frame HD atlas.
  const scaler = width === nativeWidth * 2 ? createPixelScaler(nativeWidth, nativeHeight) : null
  if (scaler) {
    // The first read of a large decoded atlas may still rasterize it, and the
    // pixel loop is initially cold. Finish this work while the native video is
    // playing, BEFORE the player samples its phase for the first visible paint.
    const warm = document.createElement('canvas')
    warm.width = width
    warm.height = height
    try {
      const context = warm.getContext('2d')
      if (!context) throw new Error('Pixel reconstruction could not be prepared.')
      scaler.paint(context, source, 0, 0, 0)
      const last = descriptor.frameCount - 1
      scaler.paint(context, source, last % descriptor.atlasColumns * nativeWidth,
        Math.floor(last / descriptor.atlasColumns) * nativeHeight, last)
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    } catch (error) {
      scaler.destroy()
      bitmap?.close()
      throw error
    } finally {
      warm.width = 1
      warm.height = 1
    }
  }
  let destroyed = false
  return {
    paint(context, sample) {
      if (destroyed) return
      context.imageSmoothingEnabled = false
      if (sample.static) {
        context.drawImage(assets.canonical, 0, 0, width, height)
        context.canvas.dataset.sourceFrame = '0'
        return
      }
      const frame = sampleSourceTime(sample.elapsedMs, timing).index
      const sx = frame % descriptor.atlasColumns * nativeWidth
      const sy = Math.floor(frame / descriptor.atlasColumns) * nativeHeight
      if (scaler) scaler.paint(context, source, sx, sy, frame)
      else context.drawImage(source, sx, sy, nativeWidth, nativeHeight, 0, 0, width, height)
      context.canvas.dataset.sourceFrame = String(frame)
      context.canvas.dataset.sourceDuration = String(timing.durationMs)
      context.canvas.dataset.motionSource = useOriginal ? 'source-anchors' : 'motion-compensated-source'
      context.canvas.dataset.pixelReconstruction = scaler ? 'scale2x' : 'native'
    },
    destroy() { destroyed = true; scaler?.destroy(); bitmap?.close() },
  }
}
