/** A deterministic snowfall field. Source imagery and its 1.28s clock are independent. */
export const POETIC_SNOW_PERIOD_MS = 48_000
export const POETIC_SNOW_WIDTH = 358
export const POETIC_SNOW_HEIGHT = 267
export const POETIC_SNOW_LAYERS = Object.freeze({ far: 192, middle: 160, near: 96 })
export type PoeticSnowDepth = keyof typeof POETIC_SNOW_LAYERS
export type PoeticSnowShape = 'point' | 'glint' | 'crystal'
export type PoeticSnowParticle = Readonly<{
  id: number
  depth: PoeticSnowDepth
  shape: PoeticSnowShape
  x: number
  y: number
  phase: number
  cyclesX: number
  cyclesY: number
  flutterCycles: number
  flutter: number
  alpha: number
}>
export type PoeticSnowSample = {
  x: number
  y: number
  /** Continuous trajectories, including across the long field's seam. */
  unwrappedX: number
  unwrappedY: number
  alpha: number
  size: number
  depth: PoeticSnowDepth
  shape: PoeticSnowShape
}

const TAU = Math.PI * 2
const MARGIN = 18
const TILE_WIDTH = POETIC_SNOW_WIDTH + MARGIN * 2
const TILE_HEIGHT = POETIC_SNOW_HEIGHT + MARGIN * 2
const fraction = (value: number): number => value - Math.floor(value)
const smoothstep = (value: number): number => {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}
const hash = (id: number, channel: number): number => {
  let value = Math.imul(id + 73, 0x45d9f3b) ^ Math.imul(channel + 31, 0x27d4eb2d)
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b)
  return ((value ^ value >>> 16) >>> 0) / 0x1_0000_0000
}

let nextId = 0
const layers = Object.entries(POETIC_SNOW_LAYERS) as [PoeticSnowDepth, number][]
export const POETIC_SNOW_PARTICLES: readonly PoeticSnowParticle[] = Object.freeze(
  layers.flatMap(([depth, count], layer) => Array.from({ length: count }, () => {
    const id = nextId++
    return Object.freeze({
      id, depth,
      shape: depth === 'near' ? 'crystal' : depth === 'middle' && hash(id, 7) > .57 ? 'glint' : 'point',
      x: hash(id, 0), y: hash(id, 1), phase: hash(id, 2) * TAU,
      cyclesX: layer + 1,
      cyclesY: layer === 0 ? 3 : layer === 1 ? 4 : 6,
      flutterCycles: 3 + Math.floor(hash(id, 3) * 3),
      flutter: .8 + hash(id, 4) * (1.2 + layer * .7),
      alpha: .34 + layer * .17 + hash(id, 5) * .16,
    })
  })),
)

/** Sparse central snow preserves the expression; it does not cut a hard face-shaped hole. */
export const poeticSnowFaceVisibility = (x: number, y: number): number => {
  const distance = Math.hypot((x - 179) / 74, (y - 109) / 77)
  return .035 + .965 * smoothstep((distance - .5) / .68)
}

/** Runtime uses one target object so sampling does not allocate on each animation frame. */
export const samplePoeticSnowInto = (
  particle: PoeticSnowParticle,
  elapsedMs: number,
  width: number,
  height: number,
  target: PoeticSnowSample,
): PoeticSnowSample => {
  const safeTime = Number.isFinite(elapsedMs) ? elapsedMs : 0
  const wholeTime = safeTime / POETIC_SNOW_PERIOD_MS
  const time = fraction(wholeTime)
  const phase = time * TAU
  const layer = particle.depth === 'far' ? 0 : particle.depth === 'middle' ? 1 : 2
  const scaleX = Number.isFinite(width) && width > 0 ? width / POETIC_SNOW_WIDTH : 1
  const scaleY = Number.isFinite(height) && height > 0 ? height / POETIC_SNOW_HEIGHT : 1
  // Slow, integrated common wind and independent small flutter avoid a pulsing wall of snow.
  const drift = (5 + layer * 3) * Math.sin(phase * 2 + .4) +
    particle.flutter * Math.sin(phase * particle.flutterCycles + particle.phase)
  const verticalFlutter = (.4 + layer * .3) * Math.sin(phase * 2 + particle.phase)
  const sourceX = fraction(particle.x + time * particle.cyclesX + drift / TILE_WIDTH) * TILE_WIDTH - MARGIN
  const sourceY = fraction(particle.y + time * particle.cyclesY + verticalFlutter / TILE_HEIGHT) * TILE_HEIGHT - MARGIN
  // Fade only in the off-screen margin: recycling cannot flash at a visible edge.
  const edgeFade = smoothstep(Math.min(sourceX + MARGIN, POETIC_SNOW_WIDTH + MARGIN - sourceX,
    sourceY + MARGIN, POETIC_SNOW_HEIGHT + MARGIN - sourceY) / MARGIN)
  const face = poeticSnowFaceVisibility(sourceX, sourceY)
  target.x = sourceX * scaleX
  target.y = sourceY * scaleY
  target.unwrappedX = ((particle.x + wholeTime * particle.cyclesX) * TILE_WIDTH + drift - MARGIN) * scaleX
  target.unwrappedY = ((particle.y + wholeTime * particle.cyclesY) * TILE_HEIGHT + verticalFlutter - MARGIN) * scaleY
  target.alpha = particle.alpha * edgeFade * face * (.95 + .05 * Math.sin(phase + particle.phase)) *
    (particle.depth === 'near' ? .7 + .3 * face : 1)
  target.size = Math.max(1, Math.round((particle.shape === 'crystal' ? 3 : particle.shape === 'glint' ? 2 : 1) * Math.min(scaleX, scaleY)))
  target.depth = particle.depth
  target.shape = particle.shape
  return target
}

/** Pure seeking helper for authoring and QA; the renderer uses samplePoeticSnowInto. */
export const samplePoeticSnow = (
  index: number, elapsedMs: number, width = POETIC_SNOW_WIDTH, height = POETIC_SNOW_HEIGHT,
): PoeticSnowSample => {
  const selected = Number.isInteger(index) ? ((index % POETIC_SNOW_PARTICLES.length) + POETIC_SNOW_PARTICLES.length) % POETIC_SNOW_PARTICLES.length : 0
  const particle = POETIC_SNOW_PARTICLES[selected]!
  return samplePoeticSnowInto(particle, elapsedMs, width, height,
    { x: 0, y: 0, unwrappedX: 0, unwrappedY: 0, alpha: 0, size: 1, depth: particle.depth, shape: particle.shape })
}
