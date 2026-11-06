import type { SceneDefinition } from '../referenceScene/types'
import { poeticPixelAssets } from './assets'
import type { ScenePreview } from './bootstrap'

const base = `${import.meta.env.BASE_URL}assets/poetic-pixel/`

export const poeticPixelDefinition: SceneDefinition = {
  version: 1,
  width: poeticPixelAssets.outputWidth,
  height: poeticPixelAssets.outputHeight,
  canonical: {
    src: `${base}${poeticPixelAssets.canonical}?v=${poeticPixelAssets.canonicalSha256}`,
    width: poeticPixelAssets.canonicalWidth,
    height: poeticPixelAssets.canonicalHeight,
  },
  layers: {},
  description: 'Vermouth 的高清像素圆形风景，樱花、富士山与夕阳之间长发随风飘动，细雪与粉色花瓣交错飞舞。',
  motionSource: 'source-timing',
}

export const poeticPreview: ScenePreview = {
  src: `${base}${poeticPixelAssets.boot.file}?v=${poeticPixelAssets.boot.sha256}`,
  width: poeticPixelAssets.boot.width,
  height: poeticPixelAssets.boot.height,
  durationMs: poeticPixelAssets.boot.durationMs,
}
