import { POETIC_PETALS, POETIC_PETAL_WIDTH, POETIC_PETAL_HEIGHT,
  samplePoeticPetalInto, type PoeticPetalSample } from './petals.ts'
import { PETAL_SPRITE_CELL, PETAL_SPRITE_ROTATIONS, PETAL_SPRITE_ATLAS_WIDTH,
  PETAL_SPRITE_ATLAS_HEIGHT, makePetalSpritePixels, petalSpriteRow } from './petalSprites.ts'

/** All rasterization is done once. No rotations, smoothing or pixel buffers are created per frame. */
export const createPoeticPetalPainter = (createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')) => {
  const atlas = createCanvas()
  atlas.width = PETAL_SPRITE_ATLAS_WIDTH
  atlas.height = PETAL_SPRITE_ATLAS_HEIGHT
  const raster = atlas.getContext('2d')
  if (!raster) throw new Error('Petal sprite rendering is unavailable.')
  const pixels = raster.createImageData(atlas.width, atlas.height)
  pixels.data.set(makePetalSpritePixels())
  raster.putImageData(pixels, 0, 0)
  const sample: PoeticPetalSample = {
    x: 0, y: 0, unwrappedX: 0, unwrappedY: 0, alpha: 0, angle: 0, tumble: 1, depth: 'far',
  }
  return (context: CanvasRenderingContext2D, elapsedMs: number,
    width = POETIC_PETAL_WIDTH, height = POETIC_PETAL_HEIGHT, opacity = 1): void => {
    const scaleX = Number.isFinite(width) && width > 0 ? width / POETIC_PETAL_WIDTH : 1
    const scaleY = Number.isFinite(height) && height > 0 ? height / POETIC_PETAL_HEIGHT : 1
    const unit = Math.max(1, Math.round(Math.min(scaleX, scaleY)))
    const diameter = PETAL_SPRITE_CELL * unit
    const layerOpacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1
    context.save()
    context.imageSmoothingEnabled = false
    for (const petal of POETIC_PETALS) {
      samplePoeticPetalInto(petal, elapsedMs, width, height, sample)
      if (sample.alpha < .02 || sample.x + diameter / 2 < 0 || sample.y + diameter / 2 < 0 ||
        sample.x - diameter / 2 > width || sample.y - diameter / 2 > height) continue
      const rotation = Math.round(sample.angle / (Math.PI * 2) * PETAL_SPRITE_ROTATIONS) % PETAL_SPRITE_ROTATIONS
      const row = petalSpriteRow(sample.depth, sample.tumble)
      context.globalAlpha = sample.alpha * layerOpacity
      context.drawImage(atlas, rotation * PETAL_SPRITE_CELL, row * PETAL_SPRITE_CELL,
        PETAL_SPRITE_CELL, PETAL_SPRITE_CELL, Math.round(sample.x - diameter / 2),
        Math.round(sample.y - diameter / 2), diameter, diameter)
    }
    context.restore()
  }
}
