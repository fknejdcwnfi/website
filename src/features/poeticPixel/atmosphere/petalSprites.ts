import type { PoeticPetalDepth } from './petals.ts'

export const PETAL_SPRITE_CELL = 11
export const PETAL_SPRITE_ROTATIONS = 32
export const PETAL_SPRITE_TUMBLES = 5
export const PETAL_SPRITE_ATLAS_WIDTH = PETAL_SPRITE_CELL * PETAL_SPRITE_ROTATIONS
export const PETAL_SPRITE_ATLAS_HEIGHT = PETAL_SPRITE_CELL * PETAL_SPRITE_TUMBLES * 3
export const PETAL_PALETTE = Object.freeze([
  '#cf73a1', '#f5adcb', '#ffe2ee', '#e98bb7',
] as const)

const COLORS = [[207, 115, 161], [245, 173, 203], [255, 226, 238], [233, 139, 183]] as const
const WIDTHS = [2.1, 4.4, 6.0]
const HEIGHTS = [3.2, 5.8, 7.4]
const TUMBLE_WIDTH = [.35, .5125, .675, .8375, 1]
// A notched rounded shoulder, tapered base and pointed tip distinguish petals from confetti.
const OUTLINE = [
  [-.10, -.98], [-.47, -.89], [-.76, -.57], [-.82, -.10], [-.65, .36],
  [-.30, .76], [0, 1], [.30, .76], [.65, .36], [.82, -.10], [.76, -.57],
  [.47, -.89], [.10, -.98], [0, -.66],
] as const

const inside = (x: number, y: number): boolean => {
  let result = false
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const a = OUTLINE[i]!, b = OUTLINE[j]!
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) result = !result
  }
  return result
}

export const petalSpriteRow = (depth: PoeticPetalDepth, tumble: number): number => {
  const layer = depth === 'far' ? 0 : depth === 'middle' ? 1 : 2
  const pose = Math.min(PETAL_SPRITE_TUMBLES - 1,
    Math.max(0, Math.round((tumble - .35) / .65 * (PETAL_SPRITE_TUMBLES - 1))))
  return layer * PETAL_SPRITE_TUMBLES + pose
}

/** Tiny hard-alpha atlas; every angle is sampled on the same native pixel grid. */
export const makePetalSpritePixels = (): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(PETAL_SPRITE_ATLAS_WIDTH * PETAL_SPRITE_ATLAS_HEIGHT * 4)
  for (let layer = 0; layer < 3; layer++) {
    for (let pose = 0; pose < PETAL_SPRITE_TUMBLES; pose++) {
      for (let rotation = 0; rotation < PETAL_SPRITE_ROTATIONS; rotation++) {
        const angle = rotation * Math.PI * 2 / PETAL_SPRITE_ROTATIONS
        const cosine = Math.cos(angle), sine = Math.sin(angle)
        const rx = WIDTHS[layer]! * TUMBLE_WIDTH[pose]! / 2, ry = HEIGHTS[layer]! / 2
        for (let y = 0; y < PETAL_SPRITE_CELL; y++) {
          for (let x = 0; x < PETAL_SPRITE_CELL; x++) {
            const dx = x + .5 - PETAL_SPRITE_CELL / 2, dy = y + .5 - PETAL_SPRITE_CELL / 2
            const u = (cosine * dx + sine * dy) / rx, v = (-sine * dx + cosine * dy) / ry
            if (!inside(u, v)) continue
            const edge = !inside(u + .65 / rx, v) || !inside(u - .65 / rx, v) ||
              !inside(u, v + .65 / ry) || !inside(u, v - .65 / ry)
            const color = COLORS[!edge && u < .1 && v < .25 ? 2 : v > .45 ? 3 : edge && layer > 0 ? 0 : 1]!
            const px = rotation * PETAL_SPRITE_CELL + x
            const py = (layer * PETAL_SPRITE_TUMBLES + pose) * PETAL_SPRITE_CELL + y
            const offset = (py * PETAL_SPRITE_ATLAS_WIDTH + px) * 4
            pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]
            pixels[offset + 3] = 255
          }
        }
      }
    }
  }
  return pixels
}
