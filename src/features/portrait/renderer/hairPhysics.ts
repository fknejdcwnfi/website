import { LOOP_MS } from '../animation/portraitTimeline.ts'
import { HAIR_NODES, type HairMaterial, type HairPhysicsConfig, type HairPhysicsDiagnostics, type HairPoses } from './hairTypes.ts'

const STEP_HZ = 240
const CACHE_HZ = 120
const DT = 1 / STEP_HZ
const PERIOD_SECONDS = LOOP_MS / 1000
const STEPS = Math.round(PERIOD_SECONDS * STEP_HZ)
const FRAMES = Math.round(PERIOD_SECONDS * CACHE_HZ)
const VALUES = HAIR_NODES * 2
const ITERATIONS = 10
const WARMUP = 3
const TAU = Math.PI * 2

const finite = (value: number, fallback: number, low: number, high: number): number =>
  Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback
const wrap = (time: number): number => Number.isFinite(time) ? ((time % LOOP_MS) + LOOP_MS) % LOOP_MS : 0

/** Compact, smooth gusts at the reference's original time scale, never frame driven. */
const gust = (time: number, center: number, width: number): number => {
  let distance = Math.abs(time - center)
  distance = Math.min(distance, PERIOD_SECONDS - distance)
  if (distance >= width) return 0
  const crest = (1 + Math.cos(Math.PI * distance / width)) * 0.5
  return crest * crest
}

export const sampleReferenceWind = (timeMs: number): number => {
  const time = wrap(timeMs) / 1000
  return 0.22 + 0.07 * Math.sin(TAU * time / PERIOD_SECONDS - 0.4)
    + 0.90 * gust(time, 2.15, 1.25) + 0.78 * gust(time, 4.15, 0.95)
    + 0.82 * gust(time, 8.15, 1.2) + 0.68 * gust(time, 10.15, 0.95)
}

type Rod = {
  rest: Float64Array
  position: Float64Array
  previous: Float64Array
  inverseMass: Float64Array
  lengths: Float64Array
  curvature: Float64Array
  bendLambda: Float64Array
  drag: number
  bendCompliance: number
  wind: number
  side: number
}

export type HairPhysicsCache = {
  rest: Float32Array[]
  poses: Float32Array[]
  maxLengthError: number
  maxSeamDistance: number
  maxDisplacement: number
}

/** Keep remounts / alternate pixel grids from recomputing the same physical cycle. */
const caches = new Map<string, HairPhysicsCache>()

const makeRod = (material: HairMaterial, scale: number, config: HairPhysicsConfig): Rod => {
  if (material.spine.length !== VALUES || !material.spine.every(Number.isFinite)) throw new Error('Invalid hair centerline.')
  const rest = Float64Array.from(material.spine, value => value / scale)
  const lengths = new Float64Array(HAIR_NODES - 1)
  const curvature = new Float64Array(HAIR_NODES - 2)
  for (let node = 1; node < HAIR_NODES; node += 1) {
    const i = node * 2
    const length = Math.hypot(rest[i]! - rest[i - 2]!, rest[i + 1]! - rest[i - 1]!)
    if (length < 0.05) throw new Error('Hair centerline has a collapsed segment.')
    lengths[node - 1] = length
    if (node < 2) continue
    const ax = rest[i - 2]! - rest[i - 4]!, ay = rest[i - 1]! - rest[i - 3]!
    const bx = rest[i]! - rest[i - 2]!, by = rest[i + 1]! - rest[i - 1]!
    curvature[node - 2] = (ax * by - ay * bx) / (lengths[node - 2]! * length)
  }
  const mass = finite(material.motion.mass, 1, 0.2, 4)
  const inverseMass = new Float64Array(HAIR_NODES)
  for (let node = 2; node < HAIR_NODES; node += 1) inverseMass[node] = 1 / (mass * (0.85 + node / HAIR_NODES * 0.3))
  return {
    rest, position: rest.slice(), previous: rest.slice(), inverseMass, lengths, curvature,
    bendLambda: new Float64Array(HAIR_NODES - 2),
    drag: finite(material.motion.drag, 1, 0.2, 4) * finite(config.damping, 5, 1, 12),
    bendCompliance: 0.0000003 / (finite(material.motion.bend, 1, 0.15, 5) * finite(config.stiffness, 18, 5, 40) / 18),
    wind: finite(material.motion.wind, 1, 0, 3), side: material.side === -1 ? -1 : 1,
  }
}

const pin = (rod: Rod): void => {
  for (let i = 0; i < 4; i += 1) {
    rod.position[i] = rod.rest[i]!
    rod.previous[i] = rod.rest[i]!
  }
}

const projectLengths = (rod: Rod, backwards: boolean): void => {
  const { position: p, inverseMass: w, lengths } = rod
  for (let step = 0; step < HAIR_NODES - 1; step += 1) {
    const node = backwards ? HAIR_NODES - 2 - step : step
    const a = node * 2, b = a + 2
    const dx = p[b]! - p[a]!, dy = p[b + 1]! - p[a + 1]!
    const length = Math.hypot(dx, dy), weight = w[node]! + w[node + 1]!
    if (weight === 0 || length < 1e-9) continue
    const correction = (length - lengths[node]!) / (length * weight)
    p[a] = p[a]! + dx * correction * w[node]!
    p[a + 1] = p[a + 1]! + dy * correction * w[node]!
    p[b] = p[b]! - dx * correction * w[node + 1]!
    p[b + 1] = p[b + 1]! - dy * correction * w[node + 1]!
  }
}

/** Signed curvature preserves a curled lock's rest shape, rather than straightening it. */
const projectCurvature = (rod: Rod): void => {
  const { position: p, inverseMass: w, lengths, curvature, bendLambda } = rod
  const alpha = rod.bendCompliance / (DT * DT)
  for (let node = 1; node < HAIR_NODES - 1; node += 1) {
    const a = (node - 1) * 2, b = a + 2, c = a + 4
    const ax = p[b]! - p[a]!, ay = p[b + 1]! - p[a + 1]!
    const bx = p[c]! - p[b]!, by = p[c + 1]! - p[b + 1]!
    const inverseLength = 1 / (lengths[node - 1]! * lengths[node]!)
    const gx0 = -by * inverseLength, gy0 = bx * inverseLength
    const gx1 = (ay + by) * inverseLength, gy1 = -(ax + bx) * inverseLength
    const gx2 = -ay * inverseLength, gy2 = ax * inverseLength
    const denominator = w[node - 1]! * (gx0 * gx0 + gy0 * gy0)
      + w[node]! * (gx1 * gx1 + gy1 * gy1) + w[node + 1]! * (gx2 * gx2 + gy2 * gy2) + alpha
    const error = (ax * by - ay * bx) * inverseLength - curvature[node - 1]!
    const lambda = (-error - alpha * bendLambda[node - 1]!) / denominator
    bendLambda[node - 1] = bendLambda[node - 1]! + lambda
    p[a] = p[a]! + w[node - 1]! * lambda * gx0
    p[a + 1] = p[a + 1]! + w[node - 1]! * lambda * gy0
    p[b] = p[b]! + w[node]! * lambda * gx1
    p[b + 1] = p[b + 1]! + w[node]! * lambda * gy1
    p[c] = p[c]! + w[node + 1]! * lambda * gx2
    p[c + 1] = p[c + 1]! + w[node + 1]! * lambda * gy2
  }
}

const stepRod = (rod: Rod, timeMs: number, config: HairPhysicsConfig, index: number): void => {
  const { position: p, previous, rest } = rod
  const direction = finite(config.direction, 1, -1, 1)
  const detail = finite(config.gust, 0.35, 0.1, 2)
  const drag = Math.exp(-rod.drag * DT)
  // The global shape-memory term models the elastic set of the original curl.
  // It is a force inside the solver, not a prescribed position animation.
  const restoration = 7.5 * finite(config.stiffness, 18, 5, 40) / 18
  for (let node = 2; node < HAIR_NODES; node += 1) {
    const i = node * 2, u = node / (HAIR_NODES - 1)
    const x = p[i]!, y = p[i + 1]!
    const vx = (x - previous[i]!) * drag, vy = (y - previous[i + 1]!) * drag
    previous[i] = x; previous[i + 1] = y
    const tx = p[i]! - p[i - 2]!, ty = p[i + 1]! - p[i - 1]!
    const tangentLength = Math.hypot(tx, ty)
    const normalExposure = 0.35 + 0.65 * Math.abs(ty) / Math.max(0.001, tangentLength)
    // The gust front travels through the lock; free ends receive its load
    // later instead of every node being forced by one simultaneous scalar.
    const wind = sampleReferenceWind(timeMs - index * 27 - u * u * 180) * (0.82 + detail * 0.5)
    const load = wind * rod.wind * (0.32 + 0.68 * u) * rod.inverseMass[node]!
    const fx = rod.side * direction * load * 420 * normalExposure + (rest[i]! - x) * restoration
    const fy = -load * 300 + (rest[i + 1]! - y) * restoration
    p[i] = x + vx + fx * DT * DT
    p[i + 1] = y + vy + fy * DT * DT
  }
  rod.bendLambda.fill(0)
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    projectCurvature(rod)
    projectLengths(rod, iteration % 2 === 1)
    pin(rod)
  }
  // Final forward/backward projections keep the actual material length close
  // even when the gust suddenly loads several adjacent nodes.
  projectLengths(rod, true)
  projectLengths(rod, false)
  pin(rod)
}

const buildCache = (locks: readonly HairMaterial[], config: HairPhysicsConfig, scale: number): HairPhysicsCache => {
  const rods = locks.map(lock => makeRod(lock, scale, config))
  const rest = rods.map(rod => Float32Array.from(rod.rest))
  const poses = rods.map(() => new Float32Array((FRAMES + 1) * VALUES))
  let maxLengthError = 0, maxSeamDistance = 0, maxDisplacement = 0
  for (let cycle = 0; cycle <= WARMUP; cycle += 1) {
    if (cycle === WARMUP) for (let lock = 0; lock < rods.length; lock += 1) poses[lock]!.set(rods[lock]!.position, 0)
    for (let step = 1; step <= STEPS; step += 1) {
      const time = step / STEP_HZ * 1000
      for (let lock = 0; lock < rods.length; lock += 1) stepRod(rods[lock]!, time, config, lock)
      if (cycle !== WARMUP || step % 2 !== 0) continue
      const offset = step / 2 * VALUES
      for (let lock = 0; lock < rods.length; lock += 1) {
        const rod = rods[lock]!
        poses[lock]!.set(rod.position, offset)
        for (let node = 0; node < HAIR_NODES; node += 1) {
          const i = node * 2
          maxDisplacement = Math.max(maxDisplacement, Math.hypot(rod.position[i]! - rod.rest[i]!, rod.position[i + 1]! - rod.rest[i + 1]!))
          if (node === 0) continue
          const length = Math.hypot(rod.position[i]! - rod.position[i - 2]!, rod.position[i + 1]! - rod.position[i - 1]!)
          maxLengthError = Math.max(maxLengthError, Math.abs(length / rod.lengths[node - 1]! - 1))
        }
      }
    }
  }
  for (const table of poses) {
    for (let node = 0; node < HAIR_NODES; node += 1) {
      const i = node * 2, end = FRAMES * VALUES + i
      maxSeamDistance = Math.max(maxSeamDistance, Math.hypot(table[end]! - table[i]!, table[end + 1]! - table[i + 1]!))
    }
    table.copyWithin(FRAMES * VALUES, 0, VALUES)
  }
  return { rest, poses, maxLengthError, maxSeamDistance, maxDisplacement }
}

/** Fixed-step constrained rods, sampled from a warmed periodic cache at any rAF. */
export class HairPhysics {
  readonly diagnostics: HairPhysicsDiagnostics
  private readonly cache: HairPhysicsCache
  private readonly rest: Float32Array[]
  private readonly lengths: Float64Array[]
  private readonly still: boolean
  private readonly scale: number

  constructor(locks: readonly HairMaterial[], config: HairPhysicsConfig, size: number, prepared?: HairPhysicsCache) {
    this.scale = finite(size, 256, 32, 2048) / 256
    const normalized = {
      direction: finite(config.direction, 1, -1, 1), gust: finite(config.gust, 0.35, 0.1, 2),
      stiffness: finite(config.stiffness, 18, 5, 40), damping: finite(config.damping, 5, 1, 12),
    }
    this.still = normalized.direction === 0
    this.rest = locks.map(lock => {
      if (lock.spine.length !== VALUES || !lock.spine.every(Number.isFinite)) throw new Error('Invalid hair centerline.')
      return lock.spine.slice()
    })
    this.lengths = this.rest.map(rest => Float64Array.from({ length: HAIR_NODES - 1 }, (_, node) => {
      const i = node * 2
      const length = Math.hypot(rest[i + 2]! - rest[i]!, rest[i + 3]! - rest[i + 1]!)
      if (length < 0.05 * this.scale) throw new Error('Hair centerline has a collapsed segment.')
      return length
    }))
    const key = JSON.stringify([normalized, locks.map(lock => [lock.side, lock.motion,
      Array.from(lock.spine, value => Math.round(value / this.scale * 1000) / 1000)])])
    let cache = prepared ?? caches.get(key)
    if (!cache) {
      cache = buildCache(locks, normalized, this.scale)
      if (caches.size >= 2) caches.delete(caches.keys().next().value!)
      caches.set(key, cache)
    }
    if (cache.rest.length !== locks.length || cache.poses.length !== locks.length
      || cache.rest.some(pose => pose.length !== VALUES)
      || cache.poses.some(table => table.length !== (FRAMES + 1) * VALUES)) throw new Error('Invalid prepared hair cycle.')
    this.cache = cache
    this.diagnostics = {
      stepsPerSecond: STEP_HZ, cacheHz: CACHE_HZ, warmupCycles: WARMUP,
      maxLengthError: cache.maxLengthError, maxSeamDistance: cache.maxSeamDistance * this.scale,
      maxDisplacement: cache.maxDisplacement * this.scale,
      retainedBytes: cache.poses.reduce((sum, table) => sum + table.byteLength, 0)
        + cache.rest.reduce((sum, table) => sum + table.byteLength, 0)
        + this.rest.reduce((sum, table) => sum + table.byteLength, 0)
        + this.lengths.reduce((sum, lengths) => sum + lengths.byteLength, 0),
    }
  }

  /** Worker transfer owns these references; do not transfer a cache still used by a live rig. */
  exportCache(): HairPhysicsCache { return this.cache }

  sample(timeMs: number, gain: number, output: HairPoses): void {
    if (output.length !== this.cache.poses.length) throw new Error('Hair pose count does not match its materials.')
    const frame = wrap(timeMs) * CACHE_HZ / 1000
    const first = Math.min(FRAMES - 1, Math.floor(frame)), blend = frame - first
    const strength = this.still ? 0 : finite(gain, 0, 0, 1)
    for (let lock = 0; lock < output.length; lock += 1) {
      const target = output[lock]!, rest = this.rest[lock]!, table = this.cache.poses[lock]!
      if (target.length !== VALUES) throw new Error('Invalid hair pose storage.')
      if (strength === 0) { target.set(rest); continue }
      const a = first * VALUES, b = a + VALUES
      if (strength < 1) {
        // Blend each bone's rotation, then reconstruct the chain. Blending node
        // positions takes a chord through the rotation and compresses a curled
        // material, especially at the debug panel's stronger wind settings.
        // Keep the solver's small length residual so the result also approaches
        // the unchanged full-strength pose continuously as gain approaches one.
        for (let i = 0; i < 4; i += 1) target[i] = rest[i]!
        let previousX = rest[2]!, previousY = rest[3]!
        for (let node = 2; node < HAIR_NODES; node += 1) {
          const i = node * 2
          const x = (table[a + i]! + (table[b + i]! - table[a + i]!) * blend) * this.scale
          const y = (table[a + i + 1]! + (table[b + i + 1]! - table[a + i + 1]!) * blend) * this.scale
          const rx = rest[i]! - rest[i - 2]!, ry = rest[i + 1]! - rest[i - 1]!
          const dx = x - previousX, dy = y - previousY
          const restLength = this.lengths[lock]![node - 1]!
          const angle = Math.atan2(rx * dy - ry * dx, rx * dx + ry * dy) * strength
          const cosine = Math.cos(angle), sine = Math.sin(angle)
          const lengthRatio = 1 + (Math.hypot(dx, dy) / restLength - 1) * strength
          target[i] = target[i - 2]! + (rx * cosine - ry * sine) * lengthRatio
          target[i + 1] = target[i - 1]! + (rx * sine + ry * cosine) * lengthRatio
          previousX = x; previousY = y
        }
        continue
      }
      for (let i = 0; i < VALUES; i += 1) {
        const position = (table[a + i]! + (table[b + i]! - table[a + i]!) * blend) * this.scale
        target[i] = i < 4 ? rest[i]! : rest[i]! + (position - rest[i]!) * strength
      }
    }
  }
}
