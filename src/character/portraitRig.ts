import { PALETTE } from './portraitAsset'
import { KEY_TIMES, LOOP_MS, MOTION_CHANNELS, sampleMotion } from '../animation/portraitTimeline'

type Point = readonly [number, number]
type Region = { id: string; polygon: readonly Point[]; root: number; end: number; amplitude: number }
type HairLayer = { group: number; pixels: number[]; field: Float32Array; x0: number; y0: number; x1: number; y1: number }
const STATIONS = 9
const TIP_LAG = [92, 105, 36, 48, 72, 88, 145, 165] as const
const LIFT = [0.22, 0.30, 0.36, 0.12, 0.18, 0.28, 0.23, 0.34] as const
export const ROOT_ANCHORS: readonly Point[] = [[18, 34], [31, 76], [215, 5], [60, 8], [52, 76], [194, 52], [45, 119], [180, 177], [78, 114], [180, 97]]
const smooth = (value: number): number => {
  const x = Math.max(0, Math.min(1, value))
  return x * x * (3 - 2 * x)
}

/** Smooth the deformation grid, never the artwork or its pixel colors. */
const softenField = (field: Float32Array, size: number): void => {
  const temp = new Float32Array(field.length)
  const radius = Math.max(2, Math.round(size / 64))
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < size; y += 1) {
      let sum = 0
      for (let x = 0; x <= radius; x += 1) sum += field[y * size + x]!
      for (let x = 0; x < size; x += 1) {
        temp[y * size + x] = sum / (Math.min(size - 1, x + radius) - Math.max(0, x - radius) + 1)
        if (x - radius >= 0) sum -= field[y * size + x - radius]!
        if (x + radius + 1 < size) sum += field[y * size + x + radius + 1]!
      }
    }
    for (let x = 0; x < size; x += 1) {
      let sum = 0
      for (let y = 0; y <= radius; y += 1) sum += temp[y * size + x]!
      for (let y = 0; y < size; y += 1) {
        field[y * size + x] = sum / (Math.min(size - 1, y + radius) - Math.max(0, y - radius) + 1)
        if (y - radius >= 0) sum -= temp[(y - radius) * size + x]!
        if (y + radius + 1 < size) sum += temp[(y + radius + 1) * size + x]!
      }
    }
  }
}

/** Nonrectangular influence regions in reference coordinates (256²). */
export const HAIR_REGIONS: readonly Region[] = [
  { id: 'hair_back', polygon: [[0, 32], [20, 30], [43, 67], [46, 105], [36, 145], [13, 165], [0, 169]], root: 25, end: 165, amplitude: 10 },
  { id: 'hair_outer_L', polygon: [[0, 82], [31, 93], [44, 120], [46, 162], [37, 180], [0, 178]], root: 70, end: 180, amplitude: 12 },
  { id: 'hair_outer_R', polygon: [[191, 0], [255, 0], [255, 128], [230, 126], [215, 112], [207, 84], [197, 59]], root: 0, end: 124, amplitude: 11 },
  { id: 'bangs', polygon: [[15, 0], [110, 0], [113, 38], [108, 61], [99, 65], [85, 55], [75, 33], [62, 48], [52, 77], [29, 79], [4, 64]], root: 0, end: 75, amplitude: 4 },
  { id: 'hair_side_L', polygon: [[32, 72], [51, 73], [66, 91], [81, 107], [81, 117], [62, 111], [51, 102], [46, 128], [31, 136]], root: 75, end: 128, amplitude: 6 },
  { id: 'hair_side_R', polygon: [[184, 50], [204, 49], [210, 95], [200, 114], [189, 106], [184, 89]], root: 40, end: 115, amplitude: 8 },
  { id: 'hair_shoulder_L', polygon: [[23, 126], [51, 114], [68, 146], [73, 178], [64, 193], [60, 222], [85, 241], [93, 255], [63, 255], [49, 231], [46, 202], [39, 190], [19, 181]], root: 115, end: 245, amplitude: 28 },
  { id: 'hair_tips_R', polygon: [[171, 174], [191, 180], [204, 204], [218, 229], [221, 248], [197, 253], [193, 234], [178, 220], [168, 202]], root: 170, end: 256, amplitude: 32 },
]

const FACE: readonly Point[] = [[109, 18], [161, 18], [171, 41], [188, 62], [188, 89], [172, 124], [143, 155], [129, 157], [111, 143], [94, 122], [73, 96], [62, 77], [83, 66], [103, 61]]
export const EYES: readonly { polygon: readonly Point[]; x0: number; x1: number; top0: number; top1: number; bottom: number }[] = [
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
  readonly rootPixels: Uint8Array
  private readonly source: Uint32Array
  private readonly closed: Uint32Array
  private readonly underpaint: Uint32Array
  private readonly layers: HairLayer[] = []
  private readonly output: ImageData
  private readonly target: Uint32Array
  private readonly eyeMap: Int8Array
  private readonly stations: Float32Array
  private readonly offsetsX = new Float32Array(MOTION_CHANNELS * STATIONS)
  private readonly offsetsY = new Float32Array(MOTION_CHANNELS * STATIONS)

  constructor(open: CanvasImageSource, closed: CanvasImageSource, size: number, underpaint: CanvasImageSource) {
    this.size = size
    const base = canvasPixels(open, size)
    this.source = new Uint32Array(base.data.buffer)
    this.closed = new Uint32Array(canvasPixels(closed, size).data.buffer)
    this.underpaint = new Uint32Array(canvasPixels(underpaint, size).data.buffer)
    this.output = new ImageData(size, size)
    this.target = new Uint32Array(this.output.data.buffer)
    this.groups = new Int8Array(size * size).fill(-1)
    this.weights = new Float32Array(size * size)
    this.protectedPixels = new Uint8Array(size * size)
    this.rootPixels = new Uint8Array(size * size)
    this.eyeMap = new Int8Array(size * size).fill(-1)
    this.stations = new Float32Array(size * size)
    const skin = new Set(PALETTE.slice(17, 27).map((color) => {
      const value = parseInt(color.slice(1), 16)
      return (0xff000000 | (value & 255) << 16 | value & 0xff00 | value >>> 16) >>> 0
    }))
    for (let i = 0; i < size * size; i += 1) {
      const x = (i % size + 0.5) * 256 / size, y = (Math.floor(i / size) + 0.5) * 256 / size
      EYES.forEach((eye, e) => { if (inside(x, y, eye.polygon)) this.eyeMap[i] = e })
      const root = ROOT_ANCHORS.some(([rx, ry]) => Math.abs(x - rx) <= 1.5 && Math.abs(y - ry) <= 1.5)
      if (root) this.rootPixels[i] = 1
      const faceOrPendant = inside(x, y, FACE) || (x > 96 && x < 177 && y > 154)
      const skinPixel = skin.has(this.source[i]!)
      // Hair may sweep over these two shoulder corridors. The body underneath
      // never moves: the underpaint is only revealed when a real lock leaves it.
      const hairCorridor = y > 114 && ((x > 12 && x < 106) || (x > 177 && x < 239))
      if (faceOrPendant || root || (skinPixel && !hairCorridor)) this.protectedPixels[i] = 1
      if (this.protectedPixels[i] || skinPixel || this.source[i]! >>> 24 === 0) continue
      HAIR_REGIONS.forEach((group, g) => {
        if (!inside(x, y, group.polygon)) return
        const rootWeight = Math.max(0, Math.min(1, (y - group.root) / (group.end - group.root))) ** 1.6
        // Foreground curls are complete locks: their free outline must move,
        // not be pinned by a falloff around the old silhouette.
        const edge = g >= 6 ? 1 : smooth(edgeDistance(x, y, group.polygon) / 16)
        const weight = edge * rootWeight * group.amplitude
        if (weight > this.weights[i]!) {
          this.weights[i] = weight
          this.groups[i] = g
          this.stations[i] = Math.max(0, Math.min(1, (y - group.root) / (group.end - group.root))) * (STATIONS - 1)
        }
      })
      // A separate, bounded mapping for the earring chain and lower drop.
      const left = x >= 72 && x <= 83 && y >= 114 && y <= 158
      const right = x >= 175 && x <= 184 && y >= 97 && y <= 135
      if (left || right) {
        const root = left ? 114 : 97, length = left ? 44 : 38
        const widthWeight = Math.min(1, (left ? Math.min(x - 72, 83 - x) : Math.min(x - 175, 184 - x)) / 2)
        this.groups[i] = left ? 8 : 9
        this.weights[i] = Math.max(0, widthWeight) * ((y - root) / length) ** 1.5 * 7
        this.stations[i] = 0
      }
    }
    for (let group = 0; group < HAIR_REGIONS.length; group += 1) {
      const pixels: number[] = []
      const field = new Float32Array(size * size)
      const distance = new Int16Array(size * size).fill(-1)
      const queue = new Int32Array(size * size)
      let head = 0, tail = 0, x0 = size, y0 = size, x1 = 0, y1 = 0
      for (let i = 0; i < this.groups.length; i += 1) {
        if (this.groups[i] !== group) continue
        pixels.push(i)
        field[i] = this.weights[i]!
        distance[i] = 0
        queue[tail++] = i
        const x = i % size, y = Math.floor(i / size)
        x0 = Math.min(x0, x); y0 = Math.min(y0, y)
        x1 = Math.max(x1, x); y1 = Math.max(y1, y)
      }
      const pad = Math.ceil((HAIR_REGIONS[group]!.amplitude * 1.5 + 3) * size / 256)
      // Extend the deformation field outside the rest silhouette, so a lock can
      // actually enter empty space. This is prepared once, not during a frame.
      while (head < tail) {
        const i = queue[head++]!, d = distance[i]!
        if (d >= pad) continue
        const x = i % size, y = Math.floor(i / size)
        for (const next of [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, y > 0 ? i - size : -1, y < size - 1 ? i + size : -1]) {
          if (next < 0 || distance[next] !== -1) continue
          distance[next] = d + 1
          field[next] = field[i]!
          queue[tail++] = next
        }
      }
      softenField(field, size)
      if (pixels.length) this.layers.push({ group, pixels, field,
        x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(size - 1, x1 + pad), y1: Math.min(size - 1, y1 + pad) })
    }
  }

  paint(ctx: CanvasRenderingContext2D, table: Float32Array[], timeMs: number, gain: number, eyeOpen: number): void {
    const { size } = this
    const localTime = ((timeMs % LOOP_MS) + LOOP_MS) % LOOP_MS
    const settle = 1 - smooth((localTime - KEY_TIMES[8]) / (KEY_TIMES[9] - KEY_TIMES[8]))
    const scale = gain * size / 256 * settle
    for (let g = 0; g < MOTION_CHANNELS; g += 1) {
      for (let station = 0; station < STATIONS; station += 1) {
        const u = station / (STATIONS - 1)
        const lag = g < 8 ? TIP_LAG[g]! * u : 0
        const lead = localTime >= lag ? sampleMotion(table, localTime - lag, g) : 0
        const trail = localTime >= lag + 72 ? sampleMotion(table, localTime - lag - 72, g) : 0
        const bend = (lead - trail) * Math.sin(u * Math.PI)
        const index = g * STATIONS + station
        this.offsetsX[index] = (lead + bend * 0.20) * scale
        this.offsetsY[index] = g < 8 ? (-lead * LIFT[g]! + bend * 0.75) * scale : 0
      }
    }
    this.target.set(this.source)
    const moving = gain !== 0 && settle !== 0 && this.offsetsX.some(value => Math.abs(value) > 0.00001)
    if (moving) {
      // Remove the old foreground once, then inverse-rasterize each moving
      // lock onto the revealed clean plate. There is no stationary copy below.
      for (const layer of this.layers) for (const i of layer.pixels) this.target[i] = this.underpaint[i]!
      for (const layer of this.layers) {
        const { group, field } = layer, region = HAIR_REGIONS[group]!
        for (let y = layer.y0; y <= layer.y1; y += 1) for (let x = layer.x0; x <= layer.x1; x += 1) {
          const i = y * size + x
          if (this.protectedPixels[i]) continue
          let sx = x, sy = y
          for (let iteration = 0; iteration < 3; iteration += 1) {
            const ix = Math.round(sx), iy = Math.round(sy)
            if (ix < 0 || ix >= size || iy < 0 || iy >= size) break
            const weight = field[iy * size + ix]!
            const phase = Math.max(0, Math.min(STATIONS - 1, (sy * 256 / size - region.root) / (region.end - region.root) * (STATIONS - 1)))
            const first = Math.floor(phase), mix = phase - first
            const a = group * STATIONS + first, b = group * STATIONS + Math.min(STATIONS - 1, first + 1)
            sx = x - (this.offsetsX[a]! + (this.offsetsX[b]! - this.offsetsX[a]!) * mix) * weight
            sy = y - (this.offsetsY[a]! + (this.offsetsY[b]! - this.offsetsY[a]!) * mix) * weight
          }
          const ix = Math.round(sx), iy = Math.round(sy)
          if (ix < 0 || ix >= size || iy < 0 || iy >= size) continue
          const sourceIndex = iy * size + ix
          if (this.groups[sourceIndex] === group) this.target[i] = this.source[sourceIndex]!
        }
      }
    }
    for (let i = 0; i < this.target.length; i += 1) {
      const group = this.groups[i]!
      if (moving && group >= 8) {
        const x = i % size, y = Math.floor(i / size)
        const phase = this.stations[i]!
        const first = Math.floor(phase), mix = phase - first
        const a = group * STATIONS + first, b = group * STATIONS + Math.min(STATIONS - 1, first + 1)
        const dx = (this.offsetsX[a]! + (this.offsetsX[b]! - this.offsetsX[a]!) * mix) * this.weights[i]!
        const dy = (this.offsetsY[a]! + (this.offsetsY[b]! - this.offsetsY[a]!) * mix) * this.weights[i]!
        const sx = Math.max(0, Math.min(size - 1, Math.round(x - dx)))
        const sy = Math.max(0, Math.min(size - 1, Math.round(y - dy)))
        const sourceIndex = sy * size + sx
        // Never pull a piece of the fixed face, body or necklace into a lock.
        this.target[i] = this.protectedPixels[sourceIndex] ? this.source[i]! : this.source[sourceIndex]!
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
