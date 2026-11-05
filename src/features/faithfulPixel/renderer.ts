import type { SceneRendererFactory } from '../referenceScene/types'
import { sampleSourceTime, validateSourceTiming } from '../referenceScene/sourceTiming'
import { faithfulPixelAssets } from './assets'

const abortError = (): DOMException => new DOMException('Pixel animation loading was cancelled.', 'AbortError')

/**
 * Each tile is a direct pixel-style conversion of one original source frame.
 * Playback changes tiles only; it never moves, blends or deforms their contents.
 */
export const createFaithfulPixelRenderer: SceneRendererFactory = async (assets, signal) => {
  const descriptor = faithfulPixelAssets
  const timing = validateSourceTiming(descriptor)
  const width = assets.definition.width
  const height = assets.definition.height
  const nativeWidth = descriptor.tileWidth
  const nativeHeight = descriptor.tileHeight
  if (descriptor.version !== 1 || nativeWidth !== 358 || nativeHeight !== 267 ||
    width !== nativeWidth * 2 || height !== nativeHeight * 2 ||
    descriptor.atlasColumns !== 4 || descriptor.atlasRows !== 4 ||
    timing.frameCount !== 16 || timing.durationMs !== 1280 ||
    timing.durationsMs.some(duration => duration !== 80) ||
    !/^[a-z0-9-]+\.png$/.test(descriptor.atlas) || !/^[a-f0-9]{64}$/.test(descriptor.atlasSha256)) {
    throw new Error('Invalid source pixel animation description.')
  }

  const atlas = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.fetchPriority = 'high'
    const cleanup = (): void => {
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', cancel)
    }
    const cancel = (): void => {
      cleanup()
      image.removeAttribute('src')
      reject(abortError())
    }
    if (signal.aborted) { cancel(); return }
    signal.addEventListener('abort', cancel, { once: true })
    image.onerror = (): void => {
      cleanup()
      reject(new Error('Pixel animation atlas could not be loaded.'))
    }
    image.onload = (): void => {
      void image.decode().then(() => {
        if (signal.aborted) { cancel(); return }
        cleanup()
        resolve(image)
      }).catch(() => {
        cleanup()
        reject(new Error('Pixel animation atlas could not be decoded.'))
      })
    }
    image.src = `${import.meta.env.BASE_URL}assets/faithful-pixel/${descriptor.atlas}?v=${descriptor.atlasSha256}`
  })
  if (signal.aborted) throw abortError()
  if (atlas.naturalWidth !== nativeWidth * descriptor.atlasColumns ||
    atlas.naturalHeight !== nativeHeight * descriptor.atlasRows) {
    throw new Error('Pixel animation atlas dimensions do not match its description.')
  }

  let bitmap: ImageBitmap | null = null
  if (typeof createImageBitmap === 'function') {
    try { bitmap = await createImageBitmap(atlas) } catch { /* Decoded native images are a supported fallback. */ }
  }
  if (signal.aborted) { bitmap?.close(); throw abortError() }
  const source: CanvasImageSource = bitmap ?? atlas
  // Prepare the image source before the player's first visible clock sample.
  const warm = document.createElement('canvas')
  warm.width = width
  warm.height = height
  try {
    const context = warm.getContext('2d')
    if (!context) throw new Error('Pixel animation could not prepare its image source.')
    context.imageSmoothingEnabled = false
    context.drawImage(source, 0, 0, nativeWidth, nativeHeight, 0, 0, width, height)
  } catch (error) {
    bitmap?.close()
    throw error
  } finally {
    warm.width = 1
    warm.height = 1
  }
  if (signal.aborted) { bitmap?.close(); throw abortError() }

  let destroyed = false
  return {
    paint(context, sample) {
      if (destroyed) return
      const phase = sampleSourceTime(sample.static ? 0 : sample.elapsedMs, timing)
      const frame = phase.index
      const canvas = context.canvas
      canvas.dataset.motionKind = 'direct-source-frames'
      canvas.dataset.sourceFrame = String(frame)
      canvas.dataset.sourceDuration = String(timing.durationMs)
      canvas.dataset.elapsedMs = String(sample.elapsedMs)
      canvas.dataset.sourceTimeMs = String(phase.timeMs)
      canvas.dataset.sourceFrameDuration = String(phase.frameDurationMs)
      canvas.dataset.pixelReconstruction = 'nearest-2x'
      // The shared player may have painted the canonical fallback during a
      // preference change. Always restore the current tile when called, even if
      // the source index has not changed since the renderer's previous call.
      context.imageSmoothingEnabled = false
      context.drawImage(source, frame % descriptor.atlasColumns * nativeWidth,
        Math.floor(frame / descriptor.atlasColumns) * nativeHeight,
        nativeWidth, nativeHeight, 0, 0, width, height)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      bitmap?.close()
    },
  }
}
