import { POETIC_SNOW_HEIGHT, POETIC_SNOW_PARTICLES, POETIC_SNOW_WIDTH,
  samplePoeticSnowInto, type PoeticSnowSample } from './snow.ts'

/** Draw after source imagery, inside the same circularly clipped viewport. */
export const createPoeticSnowPainter = () => {
  const sample: PoeticSnowSample = {
    x: 0, y: 0, unwrappedX: 0, unwrappedY: 0, alpha: 0, size: 1, depth: 'far', shape: 'point',
  }
  return (context: CanvasRenderingContext2D, elapsedMs: number, width = POETIC_SNOW_WIDTH,
    height = POETIC_SNOW_HEIGHT, opacity = 1): void => {
    const scaleX = Number.isFinite(width) && width > 0 ? width / POETIC_SNOW_WIDTH : 1
    const scaleY = Number.isFinite(height) && height > 0 ? height / POETIC_SNOW_HEIGHT : 1
    const unit = Math.max(1, Math.round(Math.min(scaleX, scaleY)))
    const layerOpacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1
    context.save()
    context.imageSmoothingEnabled = false
    for (const particle of POETIC_SNOW_PARTICLES) {
      samplePoeticSnowInto(particle, elapsedMs, width, height, sample)
      if (sample.alpha < .008 || sample.x + sample.size < 0 || sample.y + sample.size < 0 ||
        sample.x - sample.size > width || sample.y - sample.size > height) continue
      const x = Math.round(sample.x), y = Math.round(sample.y)
      context.globalAlpha = sample.alpha * layerOpacity
      context.fillStyle = sample.depth === 'far' ? '#c9dff5' : sample.depth === 'middle' ? '#edf6ff' : '#fffbed'
      context.fillRect(x, y, unit, unit)
      if (sample.shape === 'glint') {
        context.fillRect(x + unit, y, unit, unit)
      } else if (sample.shape === 'crystal') {
        context.fillRect(x - unit, y, unit, unit)
        context.fillRect(x + unit, y, unit, unit)
        context.fillRect(x, y - unit, unit, unit)
        context.fillRect(x, y + unit, unit, unit)
      }
    }
    context.restore()
  }
}
