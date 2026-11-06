/** Match the circular display's physical size without allocating an HD atlas. */
export type SceneOutputScale = 4 | 6 | 8
export type SceneResolution = Readonly<{
  width: number
  height: number
  scale: SceneOutputScale
}>

export const BASE_SCENE_RESOLUTION: SceneResolution = Object.freeze({ width: 1432, height: 1068, scale: 4 })
export const MAX_SCENE_RESOLUTION: SceneResolution = Object.freeze({ width: 2864, height: 2136, scale: 8 })

/**
 * Keep at least the existing 4x output. A narrow high-DPR phone need not allocate
 * the same surface as a wide desktop at that DPR. Unknown memory is not treated
 * as low memory; the explicit <=2GB hint limits only the optional larger backing.
 */
export const resolveSceneResolution = (
  circleCss: number,
  deviceScale: number,
  deviceMemory?: number,
): SceneResolution => {
  const diameter = Number.isFinite(circleCss) && circleCss > 0 ? circleCss : 534
  const ratio = Number.isFinite(deviceScale) && deviceScale > 0 ? deviceScale : 1
  const lowMemory = typeof deviceMemory === 'number' && Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 2
  if (lowMemory) return BASE_SCENE_RESOLUTION
  const requiredRows = diameter * ratio
  if (requiredRows <= 1068) return BASE_SCENE_RESOLUTION
  if (requiredRows <= 1602) return Object.freeze({ width: 2148, height: 1602, scale: 6 })
  return MAX_SCENE_RESOLUTION
}
