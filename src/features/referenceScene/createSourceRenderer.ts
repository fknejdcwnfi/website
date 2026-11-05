import type { SceneRendererFactory } from './types'
import { validateSourceTiming, sampleSourceTime } from './sourceTiming'
import { sourceAssetManifest, smoothAssetManifest } from './sourceAssets'

type AtlasManifest = {
  version: number
  width: number
  height: number
  frameCount: number
  frameDurationsMs: number[]
  durationMs: number
  sourceAnchorCount: number
  atlasColumns: number
  atlasRows: number
  tileWidth: number
  tileHeight: number
}

/** Playback of the owner's exact source trajectory, with source-timed blink and ornaments. */
export const createSourceRenderer: SceneRendererFactory = async (assets, signal) => {
  const useOriginal = new URLSearchParams(location.search).get('motion') === 'original'
  const prefix = useOriginal ? 'source' : 'smooth'
  const descriptor = useOriginal ? sourceAssetManifest : smoothAssetManifest
  const base = `${import.meta.env.BASE_URL}assets/reference-scene/`
  const response = await fetch(`${base}${prefix}-manifest.json?v=${descriptor.atlasSha256}`, { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error('Reference animation timing could not be loaded.')
  const data = await response.json() as AtlasManifest
  const { width, height } = assets.definition
  // The small bundled descriptor is authoritative for each versioned asset. Reject
  // changed geometry before allocating the decoded atlas; tiles remain native-size.
  const geometryKeys = ['width', 'height', 'tileWidth', 'tileHeight', 'atlasColumns', 'atlasRows', 'frameCount'] as const
  if (!data || data.version !== 1 || geometryKeys.some(key => data[key] !== descriptor[key]) ||
    data.width !== width || data.height !== height || data.tileWidth !== width || data.tileHeight !== height ||
    !Number.isInteger(data.atlasColumns) || data.atlasColumns < 1 || data.atlasColumns > 32 ||
    !Number.isInteger(data.atlasRows) || data.atlasRows < 1 || data.atlasRows > 32 ||
    data.atlasColumns * data.atlasRows < data.frameCount ||
    data.atlasColumns * width > 8192 || data.atlasRows * height > 8192) {
    throw new Error('Invalid reference animation atlas.')
  }
  const timing = validateSourceTiming(data)
  if (data.durationMs !== descriptor.durationMs || timing.durationsMs.some((duration, i) => duration !== descriptor.frameDurationsMs[i]) ||
    timing.sourceAnchorCount !== sourceAssetManifest.frameCount) {
    throw new Error('Reference animation timing does not match its authored sequence.')
  }
  const atlas = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
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
    image.onload = () => { finish(); resolve(image) }
    image.onerror = () => { finish(); reject(new Error('Reference animation atlas unavailable.')) }
    image.src = `${base}${descriptor.atlas}?v=${descriptor.atlasSha256}`
  })
  if (atlas.naturalWidth !== data.atlasColumns * width || atlas.naturalHeight !== data.atlasRows * height) {
    throw new Error('Reference animation atlas does not match its timing.')
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
      context.drawImage(atlas, frame % data.atlasColumns * width, Math.floor(frame / data.atlasColumns) * height,
        width, height, 0, 0, width, height)
      context.canvas.dataset.sourceFrame = String(frame)
      context.canvas.dataset.sourceDuration = String(timing.durationMs)
      context.canvas.dataset.motionSource = useOriginal ? 'source-anchors' : 'motion-compensated-source'
    },
    destroy() { destroyed = true },
  }
}
