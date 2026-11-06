import type { SceneDefinition } from '../referenceScene/types'
import { poeticPixelAssets } from './assets'
import type { ScenePreview } from './bootstrap'

const base = `${import.meta.env.BASE_URL}assets/poetic-pixel/`

export const poeticPixelDefinition: SceneDefinition = {
  version: 1,
  width: poeticPixelAssets.canonicalWidth,
  height: poeticPixelAssets.canonicalHeight,
  canonical: {
    src: `${base}${poeticPixelAssets.canonical}?v=${poeticPixelAssets.canonicalSha256}`,
    width: poeticPixelAssets.canonicalWidth,
    height: poeticPixelAssets.canonicalHeight,
  },
  layers: {},
  description: 'Vermouth 的高清像素圓形風景，櫻花、富士山與夕陽之間長髮隨風飄動，細雪紛飛。',
  motionSource: 'source-timing',
}

export const poeticPreview: ScenePreview = {
  src: `${base}${poeticPixelAssets.boot.file}?v=${poeticPixelAssets.boot.sha256}`,
  width: poeticPixelAssets.boot.width,
  height: poeticPixelAssets.boot.height,
  durationMs: poeticPixelAssets.boot.durationMs,
}
