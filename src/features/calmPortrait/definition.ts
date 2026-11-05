import type { SceneDefinition } from '../referenceScene/types'
import { calmAssets } from './assets'
const base = `${import.meta.env.BASE_URL}assets/calm-circle/`
export const calmPortraitDefinition: SceneDefinition = {
  version: 1, width: 716, height: 534,
  canonical: { src: `${base}${calmAssets.assets.canonical.file}?v=${calmAssets.assets.canonical.sha256}`, width: 716, height: 534 },
  layers: {},
  description: '穩定的Minecraft像素Vermouth圓形肖像，發束輕擺與自然眨眼。',
  motionSource: 'reconstructed',
}
