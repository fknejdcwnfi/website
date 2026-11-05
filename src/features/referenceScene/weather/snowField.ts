/** Deterministic, source-independent snowfall. No DOM reads, assets or timers. */
export const SNOW_PERIOD_MS = 32_000
export const SNOW_SOURCE_WIDTH = 358
export const SNOW_SOURCE_HEIGHT = 267
export const SNOW_LAYER_COUNTS = Object.freeze({ far: 96, middle: 80, near: 40 })
export type SnowDepth = keyof typeof SNOW_LAYER_COUNTS
export type SnowParticle = {
  readonly id: number
  readonly depth: SnowDepth
  readonly x: number
  readonly y: number
  readonly cyclesX: number
  readonly cyclesY: number
  readonly phase: number
  readonly flutterCycles: number
  readonly flutter: number
  readonly alpha: number
  readonly size: number
}
export type SnowSample = {
  x: number
  y: number
  /** Unwrapped trajectory allows checking direction without mistaking edge re-entry for an updraft. */
  unwrappedX: number
  unwrappedY: number
  alpha: number
  size: number
  depth: SnowDepth
}
const TAU = Math.PI * 2
const MARGIN = 16
const TILE_WIDTH = SNOW_SOURCE_WIDTH + MARGIN * 2
const TILE_HEIGHT = SNOW_SOURCE_HEIGHT + MARGIN * 2
const fraction = (value: number): number => value - Math.floor(value)
const hash = (id: number, channel: number): number => {
  let value = Math.imul(id + 1, 0x45d9f3b) ^ Math.imul(channel + 1, 0x27d4eb2d)
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b)
  return ((value ^ value >>> 16) >>> 0) / 0x1_0000_0000
}
const layers = Object.entries(SNOW_LAYER_COUNTS) as [SnowDepth, number][]
let nextId = 0
export const SNOW_PARTICLES: readonly SnowParticle[] = Object.freeze(layers.flatMap(([depth, count], layer) =>
  Array.from({ length: count }, () => {
    const id = nextId++
    return Object.freeze({
      id, depth,
      // Independent deterministic placement; there is snow everywhere from the first paint.
      x: hash(id, 0), y: hash(id, 1), phase: hash(id, 2) * TAU,
      cyclesX: layer === 2 ? 2 : 1,
      cyclesY: layer + 1 + (layer === 2 && hash(id, 3) > .6 ? 1 : 0),
      flutterCycles: 3 + Math.floor(hash(id, 4) * 4),
      flutter: 1 + hash(id, 5) * (layer + 2),
      alpha: .43 + layer * .14 + hash(id, 6) * .16,
      size: layer === 2 ? 3 : 1,
    })
  }),
))
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const smooth = (value: number): number => { const t = clamp01(value); return t * t * (3 - 2 * t) }

/** Gentle spatial density mask keeps bright flakes from repeatedly obscuring the eyes. */
export const snowFaceVisibility = (x: number, y: number): number => {
  const distance = Math.hypot((x - 179) / 67, (y - 115) / 72)
  return .06 + .94 * smooth((distance - .62) / .62)
}
const normalizedTime = (elapsedMs: number): number => fraction((Number.isFinite(elapsedMs) ? elapsedMs : 0) / SNOW_PERIOD_MS)

function sampleInto(particle: SnowParticle, time: number, width: number, height: number, target: SnowSample): SnowSample {
  const phase = time * TAU
  const depth = particle.depth === 'far' ? 0 : particle.depth === 'middle' ? 1 : 2
  // Integrated wind, rather than velocity-shaped displacement: no abrupt reset
  // or synchronized sideways pulse. Integer harmonics close the long cycle.
  const wind = (6 + depth * 4) * Math.sin(phase * 2 + .4)
  const flutter = particle.flutter * Math.sin(phase * particle.flutterCycles + particle.phase)
  const x = (particle.x + time * particle.cyclesX) * TILE_WIDTH + wind + flutter
  const y = (particle.y + time * particle.cyclesY) * TILE_HEIGHT +
    (1 + depth * .6) * Math.sin(phase * 2 + particle.phase)
  const sourceX = fraction(x / TILE_WIDTH) * TILE_WIDTH - MARGIN
  const sourceY = fraction(y / TILE_HEIGHT) * TILE_HEIGHT - MARGIN
  const scaleX = Number.isFinite(width) && width > 0 ? width / SNOW_SOURCE_WIDTH : 1
  const scaleY = Number.isFinite(height) && height > 0 ? height / SNOW_SOURCE_HEIGHT : 1
  target.x = sourceX * scaleX
  target.y = sourceY * scaleY
  target.unwrappedX = x * scaleX
  target.unwrappedY = y * scaleY
  target.alpha = particle.alpha * snowFaceVisibility(sourceX, sourceY) *
    (.94 + .06 * Math.sin(phase + particle.phase))
  target.size = Math.max(1, Math.round(particle.size * Math.min(scaleX, scaleY)))
  target.depth = particle.depth
  return target
}

/** Pure random-access sampling; paused/reduced states can use the same fixed timestamp. */
export const sampleSnowParticle = (
  index: number, elapsedMs: number, width = SNOW_SOURCE_WIDTH, height = SNOW_SOURCE_HEIGHT,
): SnowSample => {
  const particle = SNOW_PARTICLES[Number.isInteger(index) ? ((index % SNOW_PARTICLES.length) + SNOW_PARTICLES.length) % SNOW_PARTICLES.length : 0]!
  return sampleInto(particle, normalizedTime(elapsedMs), width, height,
    { x: 0, y: 0, unwrappedX: 0, unwrappedY: 0, alpha: 0, size: 1, depth: particle.depth })
}

/** One reusable sampler per player. Draw after the source; caller owns motion preference and visibility. */
export const createSnowPainter = () => {
  const sample: SnowSample = { x: 0, y: 0, unwrappedX: 0, unwrappedY: 0, alpha: 0, size: 1, depth: 'far' }
  return (context: CanvasRenderingContext2D, elapsedMs: number, width = SNOW_SOURCE_WIDTH, height = SNOW_SOURCE_HEIGHT): void => {
    const time = normalizedTime(elapsedMs)
    context.save()
    context.imageSmoothingEnabled = false
    for (const particle of SNOW_PARTICLES) {
      sampleInto(particle, time, width, height, sample)
      if (sample.x + sample.size < 0 || sample.y + sample.size < 0 || sample.x > width || sample.y > height) continue
      context.globalAlpha = sample.alpha
      context.fillStyle = particle.depth === 'far' ? '#cbddeb' : particle.depth === 'middle' ? '#e5eef6' : '#fffdf5'
      context.fillRect(Math.round(sample.x), Math.round(sample.y), sample.size, sample.size)
    }
    context.restore()
  }
}
