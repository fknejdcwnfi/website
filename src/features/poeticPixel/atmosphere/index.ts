import { createPoeticSnowPainter } from './snowRenderer.ts'
import { createPoeticPetalPainter } from './petalRenderer.ts'

export { POETIC_SNOW_PARTICLES, POETIC_SNOW_PERIOD_MS } from './snow.ts'
export { POETIC_PETALS, POETIC_PETAL_PERIOD_MS } from './petals.ts'

export type AtmosphereOptions = Readonly<{ snow?: boolean; petals?: boolean }>

/** Snow and cherry petals are the only added layers; the source image stays unchanged. */
export const createAtmospherePainter = ({ snow = true, petals = true }: AtmosphereOptions = {}) => {
  const paintSnow = snow ? createPoeticSnowPainter() : null
  const paintPetals = petals ? createPoeticPetalPainter() : null
  return (context: CanvasRenderingContext2D, elapsedMs: number, width: number, height: number, opacity = 1): void => {
    paintSnow?.(context, elapsedMs, width, height, opacity)
    paintPetals?.(context, elapsedMs, width, height, opacity)
  }
}
