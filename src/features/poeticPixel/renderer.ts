import type { SceneRendererFactory } from '../referenceScene/types'
import { sampleSourceTime, validateSourceTiming } from '../referenceScene/sourceTiming'
import { createFrameReconstruction } from './presentation/frameReconstruction'
import { readNativeAtlas } from './presentation/readNativeAtlas'
import { poeticPixelAssets, sourcePixelAssets } from './assets'
import { createAtmospherePainter, POETIC_SNOW_PARTICLES, POETIC_PETALS } from './atmosphere'

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
  if (signal.aborted) { atlas.removeAttribute('src'); throw abortError() }
  if (atlas.naturalWidth !== nativeWidth * descriptor.atlasColumns ||
    atlas.naturalHeight !== nativeHeight * descriptor.atlasRows) {
    atlas.removeAttribute('src')
    throw new Error('Pixel scene atlas dimensions do not match the description.')
  }
  let source: Awaited<ReturnType<typeof readNativeAtlas>> | undefined = await readNativeAtlas(atlas, signal)
  const weatherEnabled = parameters.get('atmosphere') !== '0' && parameters.get('snow') !== '0'
  const petalsEnabled = weatherEnabled && parameters.get('petals') !== '0'
  const prepared = (() => {
    let stage: HTMLCanvasElement | undefined
    let cache: ReturnType<typeof createFrameReconstruction> | undefined
    try {
      stage = document.createElement('canvas')
      stage.width = nativeWidth * 4
      stage.height = nativeHeight * 4
      const reconstruction = stage.getContext('2d')
      if (!reconstruction) throw new Error('Pixel scene reconstruction is unavailable.')
      cache = createFrameReconstruction(source, nativeWidth, nativeHeight)
      const paintAtmosphere = createAtmospherePainter({ snow: weatherEnabled, petals: petalsEnabled })
      // Finish constructors and raster warmup under the playing preview, before
      // ScenePlayer reads its video phase for the first visible HD paint.
      cache.paint(reconstruction, 0, 0, 0)
      const last = timing.frameCount - 1
      cache.paint(reconstruction, last % descriptor.atlasColumns * nativeWidth,
        Math.floor(last / descriptor.atlasColumns) * nativeHeight, last)
      if (signal.aborted) throw abortError()
      return { reconstructed: stage, reconstruction, scaler: cache, paintAtmosphere }
    } catch (error) {
      cache?.destroy()
      if (stage) stage.width = stage.height = 1
      throw error
    } finally {
      // The preparation closure shares its context with the returned renderer.
      // Only the cache should own native pixels after this handoff.
      source = undefined
    }
  })()
  const { reconstructed, reconstruction, scaler, paintAtmosphere } = prepared
  const inspection = parameters.has('t') || original
  let firstPaintMs: number | null = null
  let currentFrame = -1
  let destroyed = false
  return {
    paint(context, sample) {
      if (destroyed) return
      const phase = sampleSourceTime(sample.static ? 0 : sample.elapsedMs, timing)
      const frame = phase.index
      if (currentFrame !== frame) {
        scaler.paint(reconstruction, frame % descriptor.atlasColumns * nativeWidth,
          Math.floor(frame / descriptor.atlasColumns) * nativeHeight, frame)
        currentFrame = frame
      }
      context.imageSmoothingEnabled = false
      // Redraw the complete opaque base on every visible rAF. Snow is painted
      // afterwards on a continuous clock, without accumulating old flake pixels.
      const outputWidth = context.canvas.width, outputHeight = context.canvas.height
      context.drawImage(reconstructed, 0, 0, outputWidth, outputHeight)
      firstPaintMs ??= sample.elapsedMs
      const opacity = inspection ? 1 : Math.max(0, Math.min(1, (sample.elapsedMs - firstPaintMs) / 180))
      if (weatherEnabled && !sample.static) paintAtmosphere(context, sample.elapsedMs, outputWidth, outputHeight, opacity)
      const canvas = context.canvas
      canvas.dataset.motionKind = 'direct-source-frames'
      canvas.dataset.motionSource = original ? 'original-anchors' : 'source-only-interframes'
      canvas.dataset.sourceFrame = String(frame)
      canvas.dataset.sourceAnchor = String(phase.sourceIndex)
      canvas.dataset.sourceTimeMs = String(phase.timeMs)
      canvas.dataset.sourceDuration = String(timing.durationMs)
      canvas.dataset.elapsedMs = String(sample.elapsedMs)
      canvas.dataset.sourceFrameDuration = String(phase.frameDurationMs)
      canvas.dataset.pixelReconstruction = 'scale4x-adaptive'
      canvas.dataset.snowParticles = weatherEnabled && !sample.static ? String(POETIC_SNOW_PARTICLES.length) : '0'
      canvas.dataset.petalParticles = petalsEnabled && !sample.static ? String(POETIC_PETALS.length) : '0'
      canvas.dataset.snowTimeMs = String(sample.elapsedMs)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      scaler.destroy()
      reconstructed.width = reconstructed.height = 1
    },
  }
}
