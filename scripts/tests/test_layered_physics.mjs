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

test('the breeze has broad unequal swells with no isolated launch or silent loading interval', () => {
  for (const time of [0, 83.3, 2150, 4150, 8150, 10150, 11999.5]) {
    assert.equal(sampleReferenceWind(time), sampleReferenceWind(time + 12000))
    assert.equal(sampleReferenceWind(time), sampleReferenceWind(time - 12000))
  }
  const forces = Array.from({ length: 721 }, (_, frame) => sampleReferenceWind(frame * 1000 / 60))
  assert.ok(Math.min(...forces) > 0.1 && Math.max(...forces) < 1.1, 'the breeze never switches off or kicks beyond the reviewed load range')
  const change = forces.slice(1).map((value, i) => value - forces[i])
  assert.ok(Math.max(...change.map(Math.abs)) < 0.008, 'the load changes gradually across adjacent display frames')
  assert.ok(forces.filter(value => value > 0.6).length > 180, 'stronger wind is sustained rather than a narrow impulse')
  assert.ok(sampleReferenceWind(2000) > sampleReferenceWind(8000), 'the two broad swells are not identical repeats')
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
  const crest = sample(physics, materials, 2670)
  for (let lock = 0; lock < materials.length; lock += 1) {
    const rest = materials[lock].spine, pose = crest[lock]
    assert.ok(pose[16] - rest[16] > 3, 'both middles follow the same world-space breeze')
    assert.ok(pose[30] - rest[30] > 10, 'the complete free curl follows')
    assert.ok((pose[30] - rest[30]) - (pose[16] - rest[16]) > 6, 'the lock bends instead of translating rigidly')
  }
  assert.ok(crest[0][30] - materials[0].spine[30] < crest[1][30] - materials[1].spine[30],
    'inward hair travel is smaller where the artwork has limited hidden surface')
  const reverse = new HairPhysics(materials, { ...config, direction: -1 }, 256)
  for (const [lock, pose] of sample(reverse, materials, 2670).entries()) {
    assert.ok(pose[16] - materials[lock].spine[16] < -3, 'reversing the wind reverses both sides')
    assert.ok(pose[30] - materials[lock].spine[30] < -10)
  }
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

test('the broad swell produces inertial lag and a gradual return instead of prescribed position keyframes', () => {
  const rest = materials[1].spine
  let peak = { time: 0, displacement: 0 }
  for (let time = 1000; time < 3400; time += 10) {
    const displacement = sample(physics, materials, time)[1][30] - rest[30]
    if (displacement > peak.displacement) peak = { time, displacement }
  }
  assert.ok(peak.time > 2300 && peak.time < 2900, 'the free end peaks after the force crest at 2150ms')
  const retained = sample(physics, materials, 5000)[1][30] - rest[30]
  assert.ok(retained > 6 && retained < peak.displacement * 0.6, 'the curl returns gradually as the broad swell recedes')
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
