import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LOOP_MS,
  KEY_TIMES,
  BLINK_START,
  BLINK_CLOSED,
  BLINK_END,
  samplePortrait,
  createMotionTable,
  sampleMotion,
} from '../src/animation/portraitTimeline.ts'

const configuration = { direction: 1, gust: 0.35, stiffness: 18, damping: 5 }
const motion = createMotionTable(configuration)
const visualSample = ({ timeMs, wind, eyeOpen, blend }) => ({ timeMs, wind, eyeOpen, blend })
const maxMagnitude = (channel) => Math.max(...channel.map(Math.abs))

test('portrait samples all ten reference wind anchors on the 2300ms timeline', () => {
  assert.equal(LOOP_MS, 2300)
  assert.deepEqual(KEY_TIMES, [0, 230, 460, 630, 740, 850, 1020, 1300, 1570, 1890])
  const expectedWind = [0, 0.18, 0.45, 0.65, 0.70, 0.75, 0.90, 0.50, 0.20, 0]
  KEY_TIMES.forEach((time, index) => {
    const sample = samplePortrait(time, 1)
    assert.ok(Math.abs(sample.wind - expectedWind[index]) < 1e-10)
    assert.equal(sample.poseIndex, index + 1)
  })
})

test('looping and negative elapsed time resolve to the same portrait state', () => {
  for (const time of [0, 1, 230, 630, 685, 740, 795, 850, 1020, 1889.5, 2299]) {
    assert.deepEqual(samplePortrait(time, 0.65), samplePortrait(time + LOOP_MS, 0.65))
    assert.deepEqual(samplePortrait(time, 0.65), samplePortrait(time - LOOP_MS, 0.65))
  }
})

test('the cubic wind curve remains bounded and settles for the final410ms', () => {
  for (let time = 0; time < LOOP_MS; time += 1) {
    const sample = samplePortrait(time, 1)
    assert.ok(sample.wind >= 0 && sample.wind <= 0.9)
    if (time >= 1890) assert.equal(sample.wind, 0)
  }
  assert.equal(samplePortrait(115, 1).wind, 0.09)
})

test('one independent220ms blink closes fully at740ms and returns to the original eyes', () => {
  assert.equal(BLINK_END - BLINK_START, 220)
  const active = []
  for (let time = 0; time < LOOP_MS; time += 1) {
    const { eyeOpen } = samplePortrait(time, 0.65)
    assert.ok(eyeOpen >= 0 && eyeOpen <= 1)
    if (eyeOpen < 1) active.push(time)
    if (time <= BLINK_START || time >= BLINK_END) assert.equal(eyeOpen, 1)
  }
  assert.equal(active.length, 219)
  assert.equal(active[0], BLINK_START + 1)
  assert.equal(active.at(-1), BLINK_END - 1)
  assert.equal(samplePortrait(BLINK_CLOSED, 1).eyeOpen, 0)
  assert.equal(samplePortrait(685, 1).eyeOpen, 0.5)
  assert.equal(samplePortrait(795, 1).eyeOpen, 0.5)
  assert.equal(samplePortrait(740, 0).eyeOpen, 0, 'wind must not control blinking')
})

test('frozen poses are time-independent with explicit half/closed eye overrides', () => {
  for (let pose = 1; pose <= 10; pose += 1) {
    assert.deepEqual(samplePortrait(0, 0.65, pose), samplePortrait(9000, 0.65, pose))
  }
  assert.equal(samplePortrait(0, 1, 4).eyeOpen, 0.45)
  assert.equal(samplePortrait(0, 1, 5).eyeOpen, 0)
  assert.deepEqual(visualSample(samplePortrait(4321, 1, 1)), visualSample(samplePortrait(1234, 1, 10)))
})

test('malformed pure-function inputs still produce a finite bounded sample', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    const sample = samplePortrait(value, value, value)
    for (const number of Object.values(sample)) assert.ok(Number.isFinite(number))
  }
  assert.equal(samplePortrait(1020, -20).wind, 0)
  assert.equal(samplePortrait(1020, 20).wind, 0.9)
  assert.equal(samplePortrait(1020, 0).wind, 0)
})

test('the deterministic motion solve has eight hair channels plus a delayed earring channel', () => {
  assert.equal(motion.length, 9)
  const again = createMotionTable(configuration)
  motion.forEach((channel, index) => {
    assert.ok(channel instanceof Float32Array)
    assert.equal(channel.length, LOOP_MS + 1)
    assert.deepEqual(channel, again[index])
    for (const value of channel) assert.ok(Number.isFinite(value) && Math.abs(value) < 2)
  })
})

test('all spring channels start at rest and settle smoothly before the loop seam', () => {
  for (const channel of motion) {
    assert.equal(channel[0], 0)
    for (let time = 1890; time <= LOOP_MS; time += 1) assert.equal(channel[time], 0)
    assert.ok(Math.abs(channel[1889]) < 0.0001)
    assert.ok(Math.abs(channel[1889] - channel[1888]) < 0.0001)
    assert.ok(maxMagnitude(channel) > 0.01)
  }
})

test('group delays and response shapes differ instead of sharing a single sine', () => {
  const starts = motion.map(channel => channel.findIndex(value => Math.abs(value) > 1e-7))
  assert.ok(new Set(starts).size >= 7)
  assert.ok(starts[8] > starts[0], 'earrings react after the earliest hair group')
  const ratioA = motion[0][500] / motion[4][500]
  const ratioB = motion[0][1200] / motion[4][1200]
  assert.ok(Math.abs(ratioA - ratioB) > 0.02, 'channels differ in response, not only amplitude')
  assert.ok(maxMagnitude(motion[8]) < maxMagnitude(motion[4]))
})

test('direction reverses motion, zero direction stops it, and damping changes the response', () => {
  const reverse = createMotionTable({ ...configuration, direction: -1 })
  const stopped = createMotionTable({ ...configuration, direction: 0 })
  const damped = createMotionTable({ ...configuration, damping: 9 })
  motion.forEach((channel, group) => {
    for (let time = 0; time <= LOOP_MS; time += 1) {
      assert.ok(Math.abs(channel[time] + reverse[group][time]) < 1e-8)
      assert.equal(stopped[group][time], 0)
    }
  })
  assert.ok(Math.abs(motion[4][900] - damped[4][900]) > 0.01)
})

test('motion lookup interpolates fractional milliseconds and wraps independently of refresh rate', () => {
  const expected = (motion[4][800] + motion[4][801]) / 2
  assert.equal(sampleMotion(motion, 800.5, 4), expected)
  assert.equal(sampleMotion(motion, 800.5 + LOOP_MS, 4), expected)
  assert.equal(sampleMotion(motion, 800.5 - LOOP_MS, 4), expected)
  assert.equal(sampleMotion(motion, 0, 4), sampleMotion(motion, LOOP_MS, 4))
  for (const group of [-1, 9, 1.5, NaN]) assert.equal(sampleMotion(motion, 800, group), 0)
})

test('invalid solver configuration is sanitized to finite stable channels', () => {
  const table = createMotionTable({ direction: NaN, gust: Infinity, stiffness: -Infinity, damping: NaN })
  assert.deepEqual(table, motion)
  assert.equal(sampleMotion(table, Infinity, 0), 0)
})
