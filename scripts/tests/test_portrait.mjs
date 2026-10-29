import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LOOP_MS, KEY_TIMES, BLINK_CYCLE_MS, BLINK_STARTS, BLINK_START,
  BLINK_CLOSED, BLINK_END, BLINK_DURATION_MS, sampleBlink,
  sampleBlinkProgress, samplePortrait, createMotionTable, sampleMotion,
  MOTION_CHANNELS,
} from '../../src/features/portrait/animation/portraitTimeline.ts'
import {
  CHAIN_STATIONS, sampleStrandCurve, strandFlexibility, writeStrandCurve,
} from '../../src/features/portrait/renderer/strandCurve.ts'
import { StrandDynamics, solveStrandResponse } from '../../src/features/portrait/renderer/strandDynamics.ts'

const configuration = { direction: 1, gust: 0.35, stiffness: 18, damping: 5 }
const motion = createMotionTable(configuration)
const maxMagnitude = (channel) => Math.max(...channel.map(Math.abs))
const visualSample = ({ timeMs, wind, eyeOpen, blend }) => ({ timeMs, wind, eyeOpen, blend })

test('the breeze has a12second period and ten evenly spaced inspection anchors', () => {
  assert.equal(LOOP_MS, 12000)
  assert.deepEqual(KEY_TIMES, [0, 1200, 2400, 3600, 4800, 6000, 7200, 8400, 9600, 10800])
  KEY_TIMES.forEach((time, index) => assert.equal(samplePortrait(time, 1).poseIndex, index + 1))
})

test('the24second composition repeats while blinking is independent of the12second breeze', () => {
  assert.equal(BLINK_CYCLE_MS, LOOP_MS * 2)
  for (const time of [0, 1, 1200, 4400, 4450, 4500, 4600, 11350, 12000, 16450, 20350, 23999.5]) {
    assert.deepEqual(samplePortrait(time, 1), samplePortrait(time + BLINK_CYCLE_MS, 1))
    assert.deepEqual(samplePortrait(time, 1), samplePortrait(time - BLINK_CYCLE_MS, 1))
  }
  assert.equal(samplePortrait(BLINK_CLOSED, 1).timeMs, samplePortrait(BLINK_CLOSED + LOOP_MS, 1).timeMs)
  assert.equal(samplePortrait(BLINK_CLOSED, 1).eyeOpen, 0)
  assert.equal(samplePortrait(BLINK_CLOSED + LOOP_MS, 1).eyeOpen, 1)
})

test('gentle breeze metadata is always present instead of having a settled rest segment', () => {
  for (let time = 0; time < LOOP_MS; time += 13) {
    const sample = samplePortrait(time, 1)
    assert.ok(sample.wind >= 0.3 && sample.wind <= 0.7)
    assert.ok(Number.isFinite(sample.wind))
    assert.equal(samplePortrait(time, 0).wind, 0)
  }
})

test('occasional blinks use unequal gaps, a full closure hold and a slower reopening', () => {
  assert.equal(BLINK_DURATION_MS, 280)
  assert.equal(BLINK_END - BLINK_START, 280)
  const gaps = BLINK_STARTS.map((start, index) => (BLINK_STARTS[index + 1] ?? BLINK_STARTS[0] + BLINK_CYCLE_MS) - start)
  assert.deepEqual(gaps, [6900, 9000, 8100])
  for (let time = 0; time < BLINK_CYCLE_MS; time += 1) {
    const eye = sampleBlink(time)
    assert.ok(eye >= 0 && eye <= 1)
    if (!BLINK_STARTS.some(start => time > start && time < start + BLINK_DURATION_MS)) assert.equal(eye, 1)
    assert.equal(eye, samplePortrait(time, 0).eyeOpen, 'wind does not control blinking')
  }
  for (const start of BLINK_STARTS) {
    assert.equal(sampleBlink(start + 50), 0.5)
    assert.equal(sampleBlink(start + 100), 0)
    assert.equal(sampleBlink(start + 110), 0)
    assert.equal(sampleBlink(start + 120), 0)
    assert.equal(sampleBlink(start + 200), 0.5)
    assert.equal(sampleBlink(start + 280), 1)
  }
})

test('eyelid velocity joins smoothly at open, fully closed, hold and reopened boundaries', () => {
  const epsilon = 0.001
  for (const time of [0, 100, 120, 280]) {
    const at = sampleBlinkProgress(time)
    const left = (at - sampleBlinkProgress(time - epsilon)) / epsilon
    const right = (sampleBlinkProgress(time + epsilon) - at) / epsilon
    assert.ok(Math.abs(left) < 1e-8 && Math.abs(right) < 1e-8)
  }
  for (const malformed of [NaN, Infinity, -Infinity]) assert.equal(sampleBlinkProgress(malformed), 1)
})

test('subnanosecond clock differences cannot switch closed-donor and open-lash endpoint states', () => {
  for (const [time, expected] of [[0, 1], [100, 0], [120, 0], [280, 1]]) {
    for (const error of [-1e-9, 0, 1e-9]) assert.equal(sampleBlinkProgress(time + error), expected)
  }
  for (const start of BLINK_STARTS) {
    for (const error of [-1e-9, 0, 1e-9]) {
      assert.equal(sampleBlink(start + 120 + error), 0)
      assert.equal(samplePortrait(start + 120 + error, 1).eyeOpen, 0)
    }
  }
})

test('frozen poses remain explicit time-independent eye and canonical rest overrides', () => {
  for (let pose = 1; pose <= 10; pose += 1) {
    assert.deepEqual(samplePortrait(0, 1, pose), samplePortrait(90000, 1, pose))
  }
  assert.equal(samplePortrait(0, 1, 4).eyeOpen, 0.45)
  assert.equal(samplePortrait(0, 1, 5).eyeOpen, 0)
  assert.equal(samplePortrait(0, 1, 1).wind, 0)
  assert.deepEqual(visualSample(samplePortrait(4321, 1, 1)), visualSample(samplePortrait(1234, 1, 10)))
})

test('malformed pure-function inputs still produce finite bounded samples', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    const sample = samplePortrait(value, value, value)
    for (const number of Object.values(sample)) assert.ok(Number.isFinite(number))
  }
  assert.equal(samplePortrait(5000, -20).wind, 0)
  assert.equal(samplePortrait(5000, 20).wind, samplePortrait(5000, 1).wind)
})

test('steady-state wind tables are deterministic and include all eight hair and two jewelry channels', () => {
  assert.equal(motion.length, MOTION_CHANNELS)
  assert.equal(MOTION_CHANNELS, 10)
  const again = createMotionTable(configuration)
  motion.forEach((channel, index) => {
    assert.ok(channel instanceof Float32Array)
    assert.equal(channel.length, LOOP_MS + 1)
    assert.deepEqual(channel, again[index])
    for (const value of channel) assert.ok(Number.isFinite(value) && Math.abs(value) < 0.4)
    assert.ok(maxMagnitude(channel) > 0.05)
  })
})

test('the wind value and first derivative join at the seam without any forced reset', () => {
  for (const channel of motion) {
    assert.equal(channel[0], channel[LOOP_MS])
    const left = channel[LOOP_MS] - channel[LOOP_MS - 1]
    const right = channel[1] - channel[0]
    assert.ok(Math.abs(left - right) < 2e-7)
    for (let time = 1; time <= LOOP_MS; time += 1) {
      assert.ok(Math.abs(channel[time] - channel[time - 1]) < 0.0003, 'no fast impulse or settle jump')
    }
  }
})

test('there is no common motionless interval anywhere in the continuous breeze', () => {
  for (let time = 0; time < LOOP_MS; time += 100) {
    const change = Math.hypot(...motion.map((_, group) => sampleMotion(motion, time + 100, group) - sampleMotion(motion, time, group)))
    assert.ok(change > 0.002, `stationary channels near${time}ms`)
  }
})

test('short locks, long curls and jewelry respond independently and earrings follow the earliest hair', () => {
  for (let group = 1; group < MOTION_CHANNELS; group += 1) assert.notDeepEqual(motion[group], motion[0])
  const peaks = motion.map(channel => channel.indexOf(Math.max(...channel)))
  assert.ok(peaks[8] > peaks[0])
  assert.ok(peaks[9] > peaks[8])
  assert.ok(maxMagnitude(motion[8]) < maxMagnitude(motion[6]))
})

test('direction reverses motion, zero stops it and spring damping changes the steady response', () => {
  const reverse = createMotionTable({ ...configuration, direction: -1 })
  const stopped = createMotionTable({ ...configuration, direction: 0 })
  const damped = createMotionTable({ ...configuration, damping: 9 })
  motion.forEach((channel, group) => {
    for (let time = 0; time <= LOOP_MS; time += 1) {
      assert.ok(Math.abs(channel[time] + reverse[group][time]) < 1e-8)
      assert.equal(Math.abs(stopped[group][time]), 0)
    }
  })
  assert.ok(Math.abs(motion[4][900] - damped[4][900]) > 0.001)
})

test('fractional and negative wind lookups wrap at every delayed strand sample', () => {
  const expected = (motion[4][800] + motion[4][801]) / 2
  assert.equal(sampleMotion(motion, 800.5, 4), expected)
  assert.equal(sampleMotion(motion, 800.5 + LOOP_MS, 4), expected)
  assert.equal(sampleMotion(motion, 800.5 - LOOP_MS, 4), expected)
  assert.equal(sampleMotion(motion, 0, 4), sampleMotion(motion, LOOP_MS, 4))
  for (const group of [-1, MOTION_CHANNELS, 1.5, NaN]) assert.equal(sampleMotion(motion, 800, group), 0)
})

test('invalid solver inputs are sanitized and extreme settings stay bounded', () => {
  const table = createMotionTable({ direction: NaN, gust: Infinity, stiffness: -Infinity, damping: NaN })
  assert.deepEqual(table, motion)
  assert.ok(Number.isFinite(sampleMotion(table, Infinity, 0)))
  for (const config of [
    { direction: 1, gust: 2, stiffness: 5, damping: 1 },
    { direction: -1, gust: 0.1, stiffness: 40, damping: 12 },
  ]) {
    for (const channel of createMotionTable(config)) {
      for (const value of channel) assert.ok(Number.isFinite(value) && Math.abs(value) < 0.5)
      assert.equal(channel[0], channel[LOOP_MS])
    }
  }
})

test('the17-station strand curve preserves fixed roots, tips and straight strands', () => {
  assert.equal(CHAIN_STATIONS, 17)
  const offsets = Float32Array.from({ length: CHAIN_STATIONS }, (_, station) => station / 8)
  const curve = new Float64Array(offsets.length * 4)
  writeStrandCurve(offsets, curve)
  for (let station = 0; station < CHAIN_STATIONS - 1; station += 1) {
    for (const mix of [0, 0.125, 0.5, 0.875, 1]) {
      assert.equal(sampleStrandCurve(curve, station * 4, mix), (station + mix) / 8)
    }
  }
  assert.equal(sampleStrandCurve(curve, (CHAIN_STATIONS - 1) * 4, 0), offsets.at(-1))
})

test('strand bends have continuous tangents across stations and independent channels', () => {
  const offsets = Float32Array.from({ length: CHAIN_STATIONS * 2 }, (_, station) =>
    station < CHAIN_STATIONS ? Math.sin(station * 0.7) : 3)
  const curve = new Float64Array(offsets.length * 4)
  writeStrandCurve(offsets, curve)
  const epsilon = 0.00001
  for (let station = 1; station < CHAIN_STATIONS - 1; station += 1) {
    const center = sampleStrandCurve(curve, station * 4, 0)
    const left = sampleStrandCurve(curve, (station - 1) * 4, 1 - epsilon)
    const right = sampleStrandCurve(curve, station * 4, epsilon)
    assert.equal(center, offsets[station])
    assert.ok(Math.abs((center - left) / epsilon - (right - center) / epsilon) < 0.0001)
  }
  for (let station = CHAIN_STATIONS; station < CHAIN_STATIONS * 2; station += 1) {
    for (const mix of [0, 0.5, 1]) assert.equal(sampleStrandCurve(curve, station * 4, mix), 3)
  }
})


test('root-anchored flex moves visible strand middles while remaining bounded and monotone', () => {
  for (const longLock of [false, true]) {
    assert.equal(strandFlexibility(0, longLock), 0)
    assert.equal(strandFlexibility(1, longLock), 1)
    let previous = 0
    for (let station = 1; station <= 1000; station += 1) {
      const value = strandFlexibility(station / 1000, longLock)
      assert.ok(value >= previous && value <= 1)
      previous = value
    }
    assert.ok(strandFlexibility(0.5, longLock) > 0.5 ** 1.6 * 1.2)
    assert.ok(strandFlexibility(0.00001, longLock) / 0.00001 < 0.01, 'root slope remains restrained')
  }
})

test('the anchored/free spring chain preserves its static loading profile and adds increasing inertial lag', () => {
  const rest = solveStrandResponse(0, 3, 0.84)
  for (let station = 0; station < CHAIN_STATIONS; station += 1) {
    assert.ok(Math.abs(rest.real[station] - 1) < 1e-12)
    assert.equal(Math.abs(rest.imaginary[station]), 0)
  }
  const active = solveStrandResponse(Math.PI * 2 / 12, 3, 0.84)
  const phase = (station) => Math.atan2(active.imaginary[station], active.real[station])
  assert.ok(phase(0) < 0, 'air drag delays the response to wind')
  assert.ok(phase(CHAIN_STATIONS - 1) < phase(1), 'the free tip follows the proximal lock')
  const damped = solveStrandResponse(Math.PI * 2 / 12, 3, 1.2)
  assert.ok(Math.hypot(damped.real.at(-1), damped.imaginary.at(-1)) < Math.hypot(active.real.at(-1), active.imaginary.at(-1)))
})

test('coupled strand dynamics are periodic, bounded and independent of refresh cadence', () => {
  const dynamics = new StrandDynamics(motion)
  const x = new Float32Array(MOTION_CHANNELS * CHAIN_STATIONS)
  const y = new Float32Array(x.length)
  const at = (time) => { dynamics.write(time, 1, x, y); return [...x, ...y] }
  for (const time of [0, 800.5, 4400, 11300, 11999.5]) {
    assert.deepEqual(at(time), at(time + LOOP_MS))
    assert.deepEqual(at(time), at(time - LOOP_MS))
  }
  for (let time = 0; time < LOOP_MS; time += 29) {
    dynamics.write(time, 1, x, y)
    for (let group = 0; group < 8; group += 1) {
      for (let station = 0; station < CHAIN_STATIONS; station += 1) {
        const index = group * CHAIN_STATIONS + station
        assert.ok(Number.isFinite(x[index]) && Number.isFinite(y[index]))
        assert.ok(Math.abs(x[index]) <= dynamics.boundsX[group])
        assert.ok(Math.abs(y[index]) <= dynamics.boundsY[group])
      }
    }
  }
  for (const hz of [60, 120, 144, 240]) {
    let time = 0
    for (let frame = 0; frame < hz * 2; frame += 1) {
      time = (frame + 1) * 1000 / hz
      dynamics.write(time, 1, x, y)
    }
    assert.deepEqual([...x, ...y], at(2000), `${hz}Hz advances the same millisecond clock`)
  }
  dynamics.write(5000, 0, x, y)
  assert.ok([...x, ...y].every(value => value === 0))
})
