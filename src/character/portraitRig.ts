import { PALETTE } from './portraitAsset'
import { sampleMotion } from '../animation/portraitTimeline'

type Point = readonly [number, number]
type Region = { id: string; polygon: readonly Point[]; root: number; end: number; amplitude: number }

/** Nonrectangular influence regions in reference coordinates (256²). */
export const HAIR_REGIONS: readonly Region[] = [
  { id: 'hair_back', polygon: [[0, 32], [20, 30], [43, 67], [46, 105], [36, 145], [13, 165], [0, 169]], root: 25, end: 165, amplitude: 2.5 },
  { id: 'hair_outer_L', polygon: [[0, 82], [31, 93], [44, 120], [46, 162], [37, 180], [0, 178]], root: 70, end: 180, amplitude: 3 },
  { id: 'hair_outer_R', polygon: [[191, 0], [255, 0], [255, 128], [230, 126], [215, 112], [207, 84], [197, 59]], root: 0, end: 124, amplitude: 4 },
  { id: 'bangs', polygon: [[15, 0], [110, 0], [113, 38], [108, 61], [99, 65], [85, 55], [75, 33], [62, 48], [52, 77], [29, 79], [4, 64]], root: 0, end: 75, amplitude: 1.25 },
  { id: 'hair_side_L', polygon: [[32, 72], [51, 73], [66, 91], [81, 107], [81, 117], [62, 111], [51, 102], [46, 128], [31, 136]], root: 75, end: 128, amplitude: 1.8 },
  { id: 'hair_side_R', polygon: [[184, 50], [204, 49], [210, 95], [200, 114], [189, 106], [184, 89]], root: 40, end: 115, amplitude: 2 },
  { id: 'hair_shoulder_L', polygon: [[23, 126], [51, 114], [68, 146], [73, 178], [64, 193], [60, 222], [85, 241], [93, 255], [63, 255], [49, 231], [46, 202], [39, 190], [19, 181]], root: 115, end: 245, amplitude: 2 },
  { id: 'hair_tips_R', polygon: [[171, 174], [191, 180], [204, 204], [218, 229], [221, 248], [197, 253], [193, 234], [178, 220], [168, 202]], root: 170, end: 256, amplitude: 2 },
]

const FACE: readonly Point[] = [[109, 18], [161, 18], [171, 41], [188, 62], [188, 89], [172, 124], [143, 155], [129, 157], [111, 143], [94, 122], [73, 96], [62, 77], [83, 66], [103, 61]]
const EYES: readonly { polygon: readonly Point[]; x0: number; x1: number; top0: number; top1: number; bottom: number }[] = [
  { polygon: [[64, 70], [70, 67], [88, 69], [104, 74], [104, 81], [93, 87], [77, 86], [65, 81]], x0: 64, x1: 104, top0: 67, top1: 74, bottom: 87 },
  { polygon: [[138, 74], [146, 68], [160, 64], [178, 61], [183, 64], [178, 75], [168, 81], [151, 83], [140, 80]], x0: 138, x1: 183, top0: 73, top1: 61, bottom: 83 },
]

export const inside = (x: number, y: number, points: readonly Point[]): boolean => {
  let result = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!, [xj, yj] = points[j]!
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result
  }
  return result
}

const edgeDistance = (x: number, y: number, points: readonly Point[]): number => {
  let best = Infinity
  for (let i = 0; i < points.length; i += 1) {
    const [ax, ay] = points[i]!, [bx, by] = points[(i + 1) % points.length]!
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
  }
  return best
}

const canvasPixels = (image: CanvasImageSource, size: number): ImageData => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size)
}

/** All arrays are prepared once, rather than allocating images/masks during animation. */
export class PortraitRig {
  readonly size: number
  readonly groups: Int8Array
  readonly weights: Float32Array
  readonly protectedPixels: Uint8Array
  private readonly source: Uint32Array
  private readonly closed: Uint32Array
  private readonly output: ImageData
  private readonly target: Uint32Array
  private readonly eyeMap: Int8Array
  private readonly offsets = new Float32Array(9)

  constructor(open: CanvasImageSource, closed: CanvasImageSource, size: number) {
    this.size = size
    const base = canvasPixels(open, size)
    this.source = new Uint32Array(base.data.buffer)
    this.closed = new Uint32Array(canvasPixels(closed, size).data.buffer)
    this.output = new ImageData(size, size)
    this.target = new Uint32Array(this.output.data.buffer)
    this.groups = new Int8Array(size * size).fill(-1)
    this.weights = new Float32Array(size * size)
    this.protectedPixels = new Uint8Array(size * size)
    this.eyeMap = new Int8Array(size * size).fill(-1)
    const skin = new Set(PALETTE.slice(17, 27).map((color) => {
      const value = parseInt(color.slice(1), 16)
      return (0xff000000 | (value & 255) << 16 | value & 0xff00 | value >>> 16) >>> 0
    }))
    for (let i = 0; i < size * size; i += 1) {
      const x = (i % size + 0.5) * 256 / size, y = (Math.floor(i / size) + 0.5) * 256 / size
      EYES.forEach((eye, e) => { if (inside(x, y, eye.polygon)) this.eyeMap[i] = e })
      const fixed = inside(x, y, FACE) || skin.has(this.source[i]!) || (x > 93 && x < 171 && y > 158)
      if (fixed) this.protectedPixels[i] = 1
      if (fixed) continue
      HAIR_REGIONS.forEach((group, g) => {
        if (!inside(x, y, group.polygon)) return
        const rootWeight = Math.max(0, Math.min(1, (y - group.root) / (group.end - group.root))) ** 1.6
        const weight = Math.min(1, edgeDistance(x, y, group.polygon) / 6) * rootWeight * group.amplitude
        if (weight > this.weights[i]!) { this.weights[i] = weight; this.groups[i] = g }
      })
      // A separate, bounded mapping for the earring chain and lower drop.
      const left = x >= 72 && x <= 83 && y >= 114 && y <= 158
      const right = x >= 175 && x <= 184 && y >= 97 && y <= 135
      if (left || right) {
        const root = left ? 114 : 97, length = left ? 44 : 38
        const widthWeight = Math.min(1, (left ? Math.min(x - 72, 83 - x) : Math.min(x - 175, 184 - x)) / 2)
        this.groups[i] = 8
        this.weights[i] = Math.max(0, widthWeight) * ((y - root) / length) ** 1.5 * 1.3
      }
    }
  }

  paint(ctx: CanvasRenderingContext2D, table: Float32Array[], timeMs: number, gain: number, eyeOpen: number): void {
    const { size } = this
    for (let g = 0; g < 9; g += 1) this.offsets[g] = sampleMotion(table, timeMs, g) * gain * size / 256 * (g === 8 ? 4 : 1)
    for (let i = 0; i < this.target.length; i += 1) {
      const group = this.groups[i]!
      if (group < 0 || this.offsets[group] === 0) this.target[i] = this.source[i]!
      else {
        const x = i % size, y = Math.floor(i / size)
        const dx = this.offsets[group]! * this.weights[i]!
        const sx = Math.max(0, Math.min(size - 1, Math.round(x - dx)))
        const sy = Math.max(0, Math.min(size - 1, Math.round(y + (group === 8 ? 0 : dx * 0.12))))
        this.target[i] = this.source[sy * size + sx]!
      }
      const eyeIndex = this.eyeMap[i]!
      if (eyeIndex < 0 || eyeOpen >= 1) continue
      const eye = EYES[eyeIndex]!
      const x = (i % size + 0.5) * 256 / size, y = (Math.floor(i / size) + 0.5) * 256 / size
      const u = (x - eye.x0) / (eye.x1 - eye.x0)
      const top = eye.top0 + (eye.top1 - eye.top0) * u
      const bottom = eye.bottom - Math.abs(u - 0.5) * 7
      const lid = top + (bottom - top) * (1 - eyeOpen)
      if (eyeOpen <= 0 || y < lid) this.target[i] = this.closed[i]!
      // Intermediate closure has its own stepped upper-lash contour.
      if (eyeOpen > 0 && Math.abs(y - lid) < 0.65) this.target[i] = 0xff292324
    }
    ctx.putImageData(this.output, 0, 0)
  }
}
