import type { HairSide } from './hairTypes'

type Point = readonly [number, number]
export type JewelryCutout = { id: string; side: HairSide; root: Point; channel: number; mask: Uint8Array }

const packed = (color: string): number => {
  const value = parseInt(color.slice(1), 16)
  return (0xff000000 | (value & 255) << 16 | value & 0xff00 | value >>> 16) >>> 0
}
const BLUE = new Set(['#0a1b2e', '#113954', '#155a7e', '#1b75a6', '#2d95c3', '#56b9d7', '#a4e2e6'].map(packed))
const METAL = new Set([...BLUE, ...['#242329', '#403835', '#554640', '#463f3c', '#5b524b', '#74746f', '#aaa595', '#d1c4aa', '#eff6e8'].map(packed)])
const OUTLINE = new Set(['#071222', '#0b1b2b', '#102536', '#242329', '#403835', '#554640', '#463f3c', '#5b524b', '#eff6e8'].map(packed))

const distance = (x: number, y: number, a: Point, b: Point): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)
}

/** One provenance mask shared by the static plate, hair cutouts and jewelry. */
export const createJewelryMasks = (source: Uint32Array, size: number): JewelryCutout[] => {
  const scale = size / 256
  const result: JewelryCutout[] = []
  for (const [side, area, path, channel] of [
    [-1, [72, 113, 83, 158], [[73.5, 113.5], [74.5, 123.5], [74.5, 132.5], [75.5, 136.5], [77, 141.5]], 8],
    [1, [175, 97, 184, 135], [[178.5, 97.5], [178.5, 109.5], [179, 119.5]], 9],
  ] as const) {
    const mask = new Uint8Array(source.length), queue: number[] = []
    const left = Math.max(0, Math.floor(area[0] * scale)), top = Math.max(0, Math.floor(area[1] * scale))
    const right = Math.min(size - 1, Math.ceil(area[2] * scale)), bottom = Math.min(size - 1, Math.ceil(area[3] * scale))
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
      const index = y * size + x
      if (BLUE.has(source[index]!)) { mask[index] = 1; queue.push(index) }
    }
    // The blue gem retains its actual connected highlights; transparent gaps
    // never become a rectangular patch of neighboring hair.
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head]!, x = index % size, y = Math.floor(index / size)
      for (const next of [x > left ? index - 1 : -1, x < right ? index + 1 : -1, y > top ? index - size : -1, y < bottom ? index + size : -1]) {
        if (next < 0 || mask[next] || !METAL.has(source[next]!)) continue
        mask[next] = 1; queue.push(next)
      }
    }
    const radius = Math.max(1, Math.round(scale))
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
      const index = y * size + x, color = source[index]!
      if (mask[index] || color >>> 24 !== 255) continue
      const px = (x + .5) / scale, py = (y + .5) / scale
      // Disconnected silver links alternate with warm reflected colors in the
      // canonical. Trace the narrow chain itself instead of flood-filling hair.
      let chain = false
      for (let point = 1; point < path.length; point += 1) {
        if (distance(px, py, path[point - 1]!, path[point]!) <= 1.2) { chain = true; break }
      }
      if (chain) { mask[index] = 1; continue }
      if (!OUTLINE.has(color)) continue
      let edge = false
      for (let dy = -radius; dy <= radius && !edge; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
        if (x + dx < left || x + dx > right || y + dy < top || y + dy > bottom) continue
        if (BLUE.has(source[(y + dy) * size + x + dx]!)) { edge = true; break }
      }
      if (edge) mask[index] = 1
    }
    const origin = path[0]!
    result.push({ id: `earring-${side}`, side, channel, root: [origin[0] * scale, origin[1] * scale], mask })
  }
  return result
}
