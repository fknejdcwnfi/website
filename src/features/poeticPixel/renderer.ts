import type { SceneRendererFactory } from '../referenceScene/types'
import { sampleSourceTime, validateSourceTiming } from '../referenceScene/sourceTiming'
import { createPixelScaler } from '../referenceScene/pixelArtScale'
import { poeticPixelAssets, sourcePixelAssets } from './assets'
import { createPoeticSnowPainter } from './snowRenderer'

const abortError = (): DOMException => new DOMException('Pixel scene loading was cancelled.', 'AbortError')

/** Native source tiles stay compact; only the currently visible grid is reconstructed. */
export const createPoeticPixelRenderer: SceneRendererFactory = async (assets, signal) => {
  const parameters = new URLSearchParams(location.search)
  const original = parameters.get('motion') === 'original'
  const descriptor = original ? sourcePixelAssets : poeticPixelAssets
  const timing = validateSourceTiming(descriptor)
  const width = assets.definition.width
  const height = assets.definition.height
  const nativeWidth = Number(descriptor.tileWidth)
  const nativeHeight = Number(descriptor.tileHeight)
  if (descriptor.version !== 1 || nativeWidth !== 358 || nativeHeight !== 267 ||
    width !== nativeWidth * 4 || height !== nativeHeight * 4 ||
    !Number.isInteger(descriptor.atlasColumns) || !Number.isInteger(descriptor.atlasRows) ||
    descriptor.atlasColumns < 1 || descriptor.atlasRows < 1 ||
    descriptor.atlasColumns > 16 || descriptor.atlasRows > 16 ||
    descriptor.atlasColumns * descriptor.atlasRows < timing.frameCount ||
    timing.durationMs !== 1280 || timing.sourceAnchorCount !== 16 ||
    !/^[a-z0-9-]+\.png$/.test(descriptor.atlas) || !/^[a-f0-9]{64}$/.test(descriptor.atlasSha256)) {
    throw new Error('Invalid pixel scene description.')
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
    image.onerror = (): void => { cleanup(); reject(new Error('Pixel scene atlas could not be loaded.')) }
    image.onload = (): void => {
      void image.decode().then(() => {
        if (signal.aborted) { cancel(); return }
        cleanup()
        resolve(image)
      }).catch(() => { cleanup(); reject(new Error('Pixel scene atlas could not be decoded.')) })
    }
    image.src = `${import.meta.env.BASE_URL}assets/poetic-pixel/${descriptor.atlas}?v=${descriptor.atlasSha256}`
  })
  if (signal.aborted) throw abortError()
  if (atlas.naturalWidth !== nativeWidth * descriptor.atlasColumns ||
    atlas.naturalHeight !== nativeHeight * descriptor.atlasRows) {
    throw new Error('Pixel scene atlas dimensions do not match the description.')
  }

  let bitmap: ImageBitmap | null = null
  if (typeof createImageBitmap === 'function') {
    try { bitmap = await createImageBitmap(atlas) } catch { /* Native decoded image fallback remains supported. */ }
  }
  if (signal.aborted) { bitmap?.close(); throw abortError() }
  const source: CanvasImageSource = bitmap ?? atlas
  const reconstructed = document.createElement('canvas')
  reconstructed.width = nativeWidth * 2
  reconstructed.height = nativeHeight * 2
  const reconstruction = reconstructed.getContext('2d')
  if (!reconstruction) { bitmap?.close(); throw new Error('Pixel scene reconstruction is unavailable.') }
  const scaler = createPixelScaler(nativeWidth, nativeHeight)
  try {
    // Preparation and raster warmup happen under the playing preview, before
    // ScenePlayer reads the video's currentTime for its first visible paint.
    scaler.paint(reconstruction, source, 0, 0, 0)
    const last = timing.frameCount - 1
    scaler.paint(reconstruction, source, last % descriptor.atlasColumns * nativeWidth,
      Math.floor(last / descriptor.atlasColumns) * nativeHeight, last)
    if (signal.aborted) throw abortError()
  } catch (error) {
    scaler.destroy()
    bitmap?.close()
    reconstructed.width = reconstructed.height = 1
    throw error
  }
  const snow = createPoeticSnowPainter()
  const snowEnabled = parameters.get('snow') !== '0'
  let currentFrame = -1
  let destroyed = false
  return {
    paint(context, sample) {
      if (destroyed) return
      const phase = sampleSourceTime(sample.static ? 0 : sample.elapsedMs, timing)
      const frame = phase.index
      if (currentFrame !== frame) {
        scaler.paint(reconstruction, source, frame % descriptor.atlasColumns * nativeWidth,
          Math.floor(frame / descriptor.atlasColumns) * nativeHeight, frame)
        currentFrame = frame
      }
      context.imageSmoothingEnabled = false
      // Redraw the complete opaque base on every visible rAF. Snow is painted
      // afterwards on a continuous clock, without accumulating old flake pixels.
      context.drawImage(reconstructed, 0, 0, width, height)
      if (snowEnabled && !sample.static) snow(context, sample.elapsedMs, width, height)
      const canvas = context.canvas
      canvas.dataset.motionKind = 'direct-source-frames'
      canvas.dataset.motionSource = original ? 'original-anchors' : 'source-only-interframes'
      canvas.dataset.sourceFrame = String(frame)
      canvas.dataset.sourceAnchor = String(phase.sourceIndex)
      canvas.dataset.sourceTimeMs = String(phase.timeMs)
      canvas.dataset.sourceDuration = String(timing.durationMs)
      canvas.dataset.elapsedMs = String(sample.elapsedMs)
      canvas.dataset.sourceFrameDuration = String(phase.frameDurationMs)
      canvas.dataset.pixelReconstruction = 'scale2x-nearest2'
      canvas.dataset.snowParticles = snowEnabled && !sample.static ? '288' : '0'
      canvas.dataset.snowTimeMs = String(sample.elapsedMs)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      scaler.destroy()
      bitmap?.close()
      reconstructed.width = reconstructed.height = 1
    },
  }
}
