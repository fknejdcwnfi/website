/** Cherry petals share the scene coordinates, not the short character loop. */
export const POETIC_PETAL_PERIOD_MS = 96_000
export const POETIC_PETAL_WIDTH = 358
export const POETIC_PETAL_HEIGHT = 267
export const POETIC_PETAL_LAYERS = Object.freeze({ far: 20, middle: 18, near: 10 })
export type PoeticPetalDepth = keyof typeof POETIC_PETAL_LAYERS
export type PoeticPetal = Readonly<{
  id: number
  depth: PoeticPetalDepth
  x: number
  y: number
  phase: number
  cyclesX: number
  cyclesY: number
  flutterCycles: number
  turns: number
  alpha: number
}>
export type PoeticPetalSample = {
  x: number
  y: number
  unwrappedX: number
  unwrappedY: number
  alpha: number
  angle: number
  tumble: number
  depth: PoeticPetalDepth
}

const TAU = Math.PI * 2
const MARGIN = 18
const TILE_WIDTH = POETIC_PETAL_WIDTH + MARGIN * 2
const TILE_HEIGHT = POETIC_PETAL_HEIGHT + MARGIN * 2
const fraction = (value: number): number => value - Math.floor(value)
const smoothstep = (value: number): number => {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}
const hash = (id: number, channel: number): number => {
  let value = Math.imul(id + 631, 0x45d9f3b) ^ Math.imul(channel + 13, 0x27d4eb2d)
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b)
  return ((value ^ value >>> 16) >>> 0) / 0x1_0000_0000
}

let nextId = 0
const layers = Object.entries(POETIC_PETAL_LAYERS) as [PoeticPetalDepth, number][]
export const POETIC_PETALS: readonly PoeticPetal[] = Object.freeze(layers.flatMap(([depth, count], layer) =>
  Array.from({ length: count }, () => {
    const id = nextId++
    return Object.freeze({
      id, depth, x: hash(id, 0), y: hash(id, 1), phase: hash(id, 2) * TAU,
      cyclesX: layer + 1, cyclesY: layer + 2,
      flutterCycles: 5 + Math.floor(hash(id, 3) * 5),
      turns: 3 + Math.floor(hash(id, 4) * 3),
      alpha: .64 + layer * .1 + hash(id, 5) * .1,
    })
  }),
))

/** Low-opacity petals can cross the face without hiding the eyes or creating a hard hole. */
export const poeticPetalFaceVisibility = (x: number, y: number): number => {
  const face = Math.hypot((x - 179) / 75, (y - 106) / 80)
  return .075 + .925 * smoothstep((face - .43) / .72)
}

/** Sample into one reusable object. Rotation and tumble are rasterized in the sprite atlas. */
export const samplePoeticPetalInto = (
  petal: PoeticPetal,
  elapsedMs: number,
  width: number,
  height: number,
  target: PoeticPetalSample,
): PoeticPetalSample => {
  const safeTime = Number.isFinite(elapsedMs) ? elapsedMs : 0
  const wholeTime = safeTime / POETIC_PETAL_PERIOD_MS
  const time = fraction(wholeTime)
  const phase = time * TAU
  const depth = petal.depth === 'far' ? 0 : petal.depth === 'middle' ? 1 : 2
  const scaleX = Number.isFinite(width) && width > 0 ? width / POETIC_PETAL_WIDTH : 1
  const scaleY = Number.isFinite(height) && height > 0 ? height / POETIC_PETAL_HEIGHT : 1
  // The common breeze shares the snow's48s period; small private eddies make each petal distinct.
  const drift = (5 + depth * 3) * Math.sin(phase * 4 + .4) +
    (2.1 + depth * .8) * Math.sin(phase * petal.flutterCycles + petal.phase)
  const lift = (.7 + depth * .5) * Math.sin(phase * 3 + petal.phase)
  const sourceX = fraction(petal.x + time * petal.cyclesX + drift / TILE_WIDTH) * TILE_WIDTH - MARGIN
  const sourceY = fraction(petal.y + time * petal.cyclesY + lift / TILE_HEIGHT) * TILE_HEIGHT - MARGIN
  const edgeFade = smoothstep(Math.min(sourceX + MARGIN, POETIC_PETAL_WIDTH + MARGIN - sourceX,
    sourceY + MARGIN, POETIC_PETAL_HEIGHT + MARGIN - sourceY) / MARGIN)
  target.x = sourceX * scaleX
  target.y = sourceY * scaleY
  target.unwrappedX = ((petal.x + wholeTime * petal.cyclesX) * TILE_WIDTH + drift - MARGIN) * scaleX
  target.unwrappedY = ((petal.y + wholeTime * petal.cyclesY) * TILE_HEIGHT + lift - MARGIN) * scaleY
  target.alpha = petal.alpha * edgeFade * poeticPetalFaceVisibility(sourceX, sourceY)
  target.angle = fraction(time * petal.turns + petal.phase / TAU +
    .055 * Math.sin(phase * petal.flutterCycles + petal.phase)) * TAU
  target.tumble = .32 + .68 * Math.abs(Math.cos(phase * petal.flutterCycles + petal.phase))
  target.depth = petal.depth
  return target
}

/** Convenience for authoring/tests; playback uses the allocation-free Into variant. */
export const samplePoeticPetal = (
  index: number, elapsedMs: number, width = POETIC_PETAL_WIDTH, height = POETIC_PETAL_HEIGHT,
): PoeticPetalSample => {
  const normalized = Number.isInteger(index) ? ((index % POETIC_PETALS.length) + POETIC_PETALS.length) % POETIC_PETALS.length : 0
  const petal = POETIC_PETALS[normalized]!
  return samplePoeticPetalInto(petal, elapsedMs, width, height,
    { x: 0, y: 0, unwrappedX: 0, unwrappedY: 0, alpha: 0, angle: 0, tumble: 1, depth: petal.depth })
}
