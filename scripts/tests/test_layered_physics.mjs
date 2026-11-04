import assert from 'node:assert/strict'
import test from 'node:test'
import { HairPhysics, sampleReferenceWind } from '../../src/features/portrait/renderer/hairPhysics.ts'
import { HAIR_NODES } from '../../src/features/portrait/renderer/hairTypes.ts'

const config = { direction: 1, gust: 0.35, stiffness: 18, damping: 5 }
const material = (side = 1, scale = 1) => ({
  id: side < 0 ? 'left-curl' : 'right-curl', z: 2, side,
  pixels: new Uint32Array(0), bounds: { x0: 0, y0: 0, x1: 256 * scale, y1: 256 * scale },
  // A curved lock whose free end returns to its root's x coordinate. Its
  // midpoints cannot be modeled by one global-y displacement or rigid shift.
  spine: Float32Array.from(Array.from({ length: HAIR_NODES }, (_, node) => {
    const u = node / (HAIR_NODES - 1)
    return [(128 + side * (52 + 12 * Math.sin(u * Math.PI * 2))) * scale, (60 + 180 * u) * scale]
  }).flat()),
  motion: { mass: 1, drag: 1, bend: 1, wind: 1 },
})
const materials = [material(-1), material(1)]
const physics = new HairPhysics(materials, config, 256)
const makeOutput = locks => locks.map(() => new Float32Array(HAIR_NODES * 2))
const sample = (engine, locks, time, gain = 1) => {
  const output = makeOutput(locks)
  engine.sample(time, gain, output)
  return output
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

test('the cross-breeze varies smoothly through the full period without switching off', () => {
  for (const time of [0, 83.3, 2150, 4150, 8150, 10150, 11999.5]) {
    assert.equal(sampleReferenceWind(time), sampleReferenceWind(time + 12000))
    assert.equal(sampleReferenceWind(time), sampleReferenceWind(time - 12000))
  }
  const forces = Array.from({ length: 721 }, (_, frame) => sampleReferenceWind(frame * 1000 / 60))
  assert.ok(Math.min(...forces) > 0.1 && Math.max(...forces) < 1.1, 'the breeze never switches off or kicks beyond the reviewed load range')
  const change = forces.slice(1).map((value, i) => value - forces[i])
  assert.ok(Math.max(...change.map(Math.abs)) < 0.008, 'the load changes gradually across adjacent display frames')
  assert.ok(forces.filter(value => value > 0.6).length > 180, 'stronger wind is sustained rather than a narrow impulse')
  assert.ok(Math.abs(sampleReferenceWind(2000) - sampleReferenceWind(8000)) > 0.01, 'the second half is not an identical replay of the first')
  const before = sampleReferenceWind(-0.5), at = sampleReferenceWind(0), after = sampleReferenceWind(0.5)
  assert.ok(Math.abs((at - before) - (after - at)) < 1e-6, 'the wind derivative joins at the loop seam')
})

test('constrained curl rods keep two anchored nodes and material length while changing curvature', () => {
  assert.equal(physics.diagnostics.stepsPerSecond, 240)
  assert.equal(physics.diagnostics.cacheHz, 120)
  assert.ok(physics.diagnostics.maxLengthError < 0.03)
  assert.ok(physics.diagnostics.maxSeamDistance < 0.02)
  assert.ok(physics.diagnostics.maxDisplacement > 20 && physics.diagnostics.maxDisplacement < 50)
  for (let time = 0; time < 12000; time += 83.3) {
    const output = sample(physics, materials, time)
    for (let lock = 0; lock < materials.length; lock += 1) {
      const rest = materials[lock].spine, pose = output[lock]
      assert.deepEqual(pose.slice(0, 4), rest.slice(0, 4), 'the proximal segment never drifts')
      for (let node = 1; node < HAIR_NODES; node += 1) {
        const i = node * 2
        const resting = distance(rest.slice(i - 2, i), rest.slice(i, i + 2))
        const current = distance(pose.slice(i - 2, i), pose.slice(i, i + 2))
        assert.ok(Math.abs(current / resting - 1) < 0.03, 'raster interpolation cannot stretch the material')
      }
    }
  }
  const peakTravel = (engine, sign) => {
    const maxima = materials.map(() => ({ middle: 0, tip: 0 }))
    for (let time = 0; time < 12000; time += 1000 / 60) {
      for (const [lock, pose] of sample(engine, materials, time).entries()) {
        maxima[lock].middle = Math.max(maxima[lock].middle, sign * (pose[16] - materials[lock].spine[16]))
        maxima[lock].tip = Math.max(maxima[lock].tip, sign * (pose[30] - materials[lock].spine[30]))
      }
    }
    for (const travel of maxima) {
      assert.ok(travel.middle > 3, 'both middles follow the same world-space breeze')
      assert.ok(travel.tip > travel.middle * 2, 'the free end bends substantially more than the attached middle')
    }
    return maxima
  }
  const crest = peakTravel(physics, 1)
  assert.ok(crest[0].tip < crest[1].tip,
    'inward hair travel is smaller where the artwork has limited hidden surface')
  peakTravel(new HairPhysics(materials, { ...config, direction: -1 }, 256), -1)
})

test('the free end moves continuously through the cycle without a 60 Hz velocity jump', () => {
  const frames = []
  for (let frame = -1; frame <= 721; frame += 1) frames.push(sample(physics, materials, frame * 1000 / 60)[1][30])
  const movement = frames.slice(1).map((value, i) => value - frames[i])
  for (let frame = 1; frame < movement.length; frame += 1) {
    assert.ok(Math.abs(movement[frame] - movement[frame - 1]) < 0.1, 'neighboring frame velocities have no visible snap, including the loop seam')
  }
  for (let start = 0; start < 720; start += 30) {
    const travel = movement.slice(start, start + 30).reduce((sum, distance) => sum + Math.abs(distance), 0)
    assert.ok(travel > 0.1, 'the free end does not freeze during quiet half-second windows')
  }
})

const correlation = (a, b) => {
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length
  const ma = mean(a), mb = mean(b)
  let numerator = 0, aa = 0, bb = 0
  for (let index = 0; index < a.length; index += 1) {
    const x = a[index] - ma, y = b[index] - mb
    numerator += x * y; aa += x * x; bb += y * y
  }
  return numerator / Math.sqrt(aa * bb)
}

const velocity = values => values.map((value, frame) => value - values[(frame + values.length - 1) % values.length])

test('the free end follows a bending middle with a short inertial delay', () => {
  const poses = Array.from({ length: 720 }, (_, frame) => sample(physics, materials, frame * 1000 / 60)[1])
  const middle = velocity(poses.map(pose => pose[16])), tip = velocity(poses.map(pose => pose[30]))
  const candidates = Array.from({ length: 37 }, (_, lag) => ({ lag,
    correlation: correlation(middle, tip.map((_, frame) => tip[(frame + lag) % tip.length])),
  }))
  const best = candidates.reduce((a, b) => b.correlation > a.correlation ? b : a)
  assert.ok(best.lag >= 1 && best.lag <= 36, 'the tip follows the middle instead of reversing at one prescribed global timestamp')
  assert.ok(best.correlation > .95, 'the end remains connected to the same coherent bending lock')
})

test('air flowing along a horizontal lock does not create an artificial upward tide', () => {
  const lock = { ...material(1), spine: Float32Array.from(Array.from({ length: HAIR_NODES }, (_, node) =>
    [40 + node / (HAIR_NODES - 1) * 180, 100]).flat()) }
  const engine = new HairPhysics([lock], config, 256)
  for (let frame = 0; frame < 720; frame += 1) {
    const [pose] = sample(engine, [lock], frame * 1000 / 60)
    for (let node = 2; node < HAIR_NODES; node += 1) {
      assert.ok(pose[node * 2 + 1] >= 99.99, 'tangent air motion must not lift the whole free section')
    }
  }
})

test('neighboring locks catch different eddies rather than rising and falling as one sheet', () => {
  const locks = [material(1), material(1)]
  const engine = new HairPhysics(locks, config, 256)
  const frames = Array.from({ length: 720 }, (_, frame) => sample(engine, locks, frame * 1000 / 60).map(pose => pose[30]))
  const a = velocity(frames.map(frame => frame[0])), b = velocity(frames.map(frame => frame[1]))
  assert.ok(a.some(value => Math.abs(value) > .01) && b.some(value => Math.abs(value) > .01), 'both locks keep moving')
  assert.ok(correlation(a, b) < .95, 'local air variation prevents perfectly synchronized lock velocities')
})

test('partial wind gain keeps strongly bent material long instead of compressing its rotational arc', () => {
  const strong = new HairPhysics(materials, { ...config, gust: 2, stiffness: 5, damping: 1 }, 256)
  assert.ok(strong.diagnostics.maxDisplacement > 100, 'this fixture exercises large debug-panel rotations')
  for (const gain of [0.25, 0.5, 0.75]) {
    for (let time = 0; time < 12000; time += 83.3) {
      const output = sample(strong, materials, time, gain)
      for (let lock = 0; lock < materials.length; lock += 1) {
        const rest = materials[lock].spine, pose = output[lock]
        assert.deepEqual(pose.slice(0, 4), rest.slice(0, 4), 'gain never moves either root node')
        for (let node = 1; node < HAIR_NODES; node += 1) {
          const i = node * 2
          const resting = Math.hypot(rest[i] - rest[i - 2], rest[i + 1] - rest[i - 1])
          const current = Math.hypot(pose[i] - pose[i - 2], pose[i + 1] - pose[i - 1])
          assert.ok(Math.abs(current / resting - 1) < 0.002, 'partial gain retains the solver’s subpixel length tolerance')
        }
      }
    }
    for (const time of [0, 823.5, 2670, 11999.3]) {
      assert.deepEqual(sample(strong, materials, time, gain), sample(strong, materials, time + 12000, gain))
    }
    const before = sample(strong, materials, -0.5, gain), at = sample(strong, materials, 0, gain), after = sample(strong, materials, 0.5, gain)
    for (let lock = 0; lock < materials.length; lock += 1) for (let i = 0; i < HAIR_NODES * 2; i += 1) {
      assert.ok(Math.abs((at[lock][i] - before[lock][i]) - (after[lock][i] - at[lock][i])) < 0.003, 'partial gain keeps the original seamless clock')
    }
  }
  for (const time of [0, 2500, 10000]) {
    const frame = time * strong.diagnostics.cacheHz / 1000
    const output = sample(strong, materials, time)
    for (let lock = 0; lock < materials.length; lock += 1) {
      const cached = strong.exportCache().poses[lock].slice(frame * HAIR_NODES * 2, (frame + 1) * HAIR_NODES * 2)
      cached.set(materials[lock].spine.subarray(0, 4))
      assert.deepEqual(output[lock], cached, 'gain one keeps every original cached coordinate')
    }
  }
})

test('periodic warmed poses are independent of sampling history and join without resetting roots or velocity', () => {
  for (const time of [0, 823.5, 4500, 8150, 11999.3]) {
    assert.deepEqual(sample(physics, materials, time), sample(physics, materials, time + 12000))
    assert.deepEqual(sample(physics, materials, time), sample(physics, materials, time - 12000))
  }
  const before = sample(physics, materials, -0.5), at = sample(physics, materials, 0), after = sample(physics, materials, 0.5)
  for (let lock = 0; lock < materials.length; lock += 1) for (let i = 0; i < HAIR_NODES * 2; i += 1) {
    assert.ok(Math.abs((at[lock][i] - before[lock][i]) - (after[lock][i] - at[lock][i])) < 0.003)
  }
  const common = sample(physics, materials, 2000)
  for (const hz of [60, 120, 144, 240]) {
    const output = makeOutput(materials)
    for (let frame = 1; frame <= hz * 2; frame += 1) physics.sample(frame * 1000 / hz, 1, output)
    assert.deepEqual(output, common)
  }
})

test('worker-prepared normalized cycles preserve exact rest poses at all supported grids', () => {
  const prepared = physics.exportCache()
  for (const size of [192, 256, 320]) {
    const scale = size / 256, locks = [material(-1, scale), material(1, scale)]
    const engine = new HairPhysics(locks, config, size, prepared)
    const still = sample(engine, locks, 2670, 0)
    for (let lock = 0; lock < locks.length; lock += 1) assert.deepEqual(still[lock], locks[lock].spine)
    const active = sample(engine, locks, 2670), normal = sample(physics, materials, 2670)
    for (let lock = 0; lock < locks.length; lock += 1) for (let i = 0; i < active[lock].length; i += 1) {
      assert.ok(Math.abs(active[lock][i] / scale - normal[lock][i]) < 0.0001)
    }
  }
})

test('zero, invalid and extreme inputs are finite, with constrained length and bounded sampling storage', () => {
  const zero = new HairPhysics(materials, { ...config, direction: 0 }, 256)
  assert.deepEqual(sample(zero, materials, 2150), materials.map(lock => lock.spine))
  const extreme = new HairPhysics(materials, { direction: -Infinity, gust: Infinity, stiffness: -500, damping: NaN }, 256)
  assert.ok(extreme.diagnostics.maxLengthError < 0.03)
  for (const time of [NaN, Infinity, -9000, 2 ** 40]) for (const pose of sample(extreme, materials, time)) assert.ok(pose.every(Number.isFinite))
  assert.throws(() => physics.sample(0, 1, []), /count/)
  assert.throws(() => physics.sample(0, 1, [new Float32Array(1), new Float32Array(32)]), /storage/)
  assert.throws(() => new HairPhysics([{ ...materials[0], spine: new Float32Array(32) }], config, 256), /collapsed/)
  assert.throws(() => new HairPhysics([{ ...materials[0], spine: new Float32Array(32) }, materials[1]], config, 256, physics.exportCache()), /collapsed/)
})
