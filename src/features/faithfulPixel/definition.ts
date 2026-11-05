import type { SceneDefinition } from '../referenceScene/types'
import { faithfulPixelAssets } from './assets'

const base = `${import.meta.env.BASE_URL}assets/faithful-pixel/`

/** The source scene is retained inside the existing borderless circular viewport. */
export const faithfulPixelDefinition: SceneDefinition = {
  version: 1,
  width: 716,
  height: 534,
  canonical: {
    src: `${base}${faithfulPixelAssets.canonical}?v=${faithfulPixelAssets.canonicalSha256}`,
    width: 716,
    height: 534,
  },
  layers: {},
  description: 'Vermouth 的像素圓形肖像，依原動畫的逐幀動作呈現飄髮、眨眼與富士山景色。',
  motionSource: 'source-timing',
}
