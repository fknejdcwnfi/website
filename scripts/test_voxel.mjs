import assert from 'node:assert/strict'
import test from 'node:test'
import { readStageOptions } from '../src/animation/stageOptions.ts'
import { LOOP_MS, sampleVoxel } from '../src/animation/voxelTimeline.ts'

test('the default stage is the personalized voxel scene', () => {
  assert.deepEqual(readStageOptions(''), {
    style: 'voxel',
    debug: false,
    frozenPose: null,
    wind: 0.65,
    speed: 1,
    seed: 7,
    theme: 'midnight',
  })
})

test('legacy, debug and supported themes remain explicit URL options', () => {
  const legacy = readStageOptions('?style=legacy&debug=1&pose=5')
  assert.equal(legacy.style, 'legacy')
  assert.equal(legacy.debug, true)
  assert.equal(legacy.frozenPose, 5)
  for (const theme of ['midnight', 'emerald', 'amethyst']) {
    assert.equal(readStageOptions(`?theme=${theme}`).theme, theme)
  }
  const unknown = readStageOptions('?style=unknown&debug=true&theme=unknown')
  assert.equal(unknown.style, 'voxel')
  assert.equal(unknown.debug, false)
  assert.equal(unknown.theme, 'midnight')
})

test('frozen poses accept only integers from one through ten', () => {
  for (let pose = 1; pose <= 10; pose += 1) {
    assert.equal(readStageOptions(`?pose=${pose}`).frozenPose, pose)
  }
  for (const pose of ['', '0', '11', '-1', '1.5', 'NaN', 'Infinity', 'wrong']) {
    assert.equal(readStageOptions(`?pose=${pose}`).frozenPose, null)
  }
})

test('URL controls reject non-finite values and clamp finite extremes', () => {
  for (const value of ['NaN', 'Infinity', '-Infinity', 'wrong']) {
    const options = readStageOptions(`?wind=${value}&speed=${value}&seed=${value}`)
    assert.equal(options.wind, 0.65)
    assert.equal(options.speed, 1)
    assert.equal(options.seed, 7)
  }
  assert.equal(readStageOptions('?wind=-20').wind, 0)
  assert.equal(readStageOptions('?wind=20').wind, 1)
  assert.equal(readStageOptions('?speed=-20').speed, 0.25)
  assert.equal(readStageOptions('?speed=20').speed, 2)
  const options = readStageOptions('?wind=0.2&speed=1.5&seed=42')
  assert.equal(options.wind, 0.2)
  assert.equal(options.speed, 1.5)
  assert.equal(options.seed, 42)
  for (const value of ['-1', '4294967296', '2.75']) {
    const seed = readStageOptions(`?seed=${value}`).seed
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff)
  }
})

test('the 4800 ms timeline repeats without a seam, including negative time', () => {
  assert.equal(LOOP_MS, 4800)
  for (const time of [0, 1, 740, 1020, 2100, 2320, 4799]) {
    const expected = sampleVoxel(time, 0.65)
    assert.deepEqual(sampleVoxel(time + LOOP_MS, 0.65), expected)
    assert.deepEqual(sampleVoxel(time - LOOP_MS, 0.65), expected)
  }
})

test('blink is one continuous 220 ms event per loop and fully closes', () => {
  const active = []
  let minEyeOpen = 1
  for (let time = 0; time < LOOP_MS; time += 1) {
    const sample = sampleVoxel(time, 0.65)
    assert.ok(sample.eyeOpen >= 0 && sample.eyeOpen <= 1)
    assert.ok(Number.isFinite(sample.wind) && sample.wind >= 0 && sample.wind <= 1)
    minEyeOpen = Math.min(minEyeOpen, sample.eyeOpen)
    if (sample.eyeOpen < 1) active.push(time)
  }
  assert.equal(minEyeOpen, 0, 'the eyes must actually close')
  assert.ok(active.length >= 218 && active.length <= 220)
  for (let index = 1; index < active.length; index += 1) {
    assert.equal(active[index], active[index - 1] + 1, 'blink cannot flicker or split')
  }
  assert.equal(sampleVoxel(active[0] - 1, 0.65).eyeOpen, 1)
  assert.equal(sampleVoxel(active.at(-1) + 1, 0.65).eyeOpen, 1)
})

test('pose one and ten have identical resting visuals, while pose five closes eyes', () => {
  const { timeMs, wind, eyeOpen, blend } = sampleVoxel(1234, 0.65, 1)
  const rest = sampleVoxel(4321, 0.65, 10)
  assert.deepEqual({ timeMs, wind, eyeOpen, blend }, {
    timeMs: rest.timeMs,
    wind: rest.wind,
    eyeOpen: rest.eyeOpen,
    blend: rest.blend,
  })
  assert.equal(sampleVoxel(0, 0.65, 1).eyeOpen, 1)
  assert.equal(sampleVoxel(0, 0.65, 5).eyeOpen, 0)
})

test('frozen poses are time-independent and wind zero stops hair motion', () => {
  for (let pose = 1; pose <= 10; pose += 1) {
    assert.deepEqual(sampleVoxel(0, 0.65, pose), sampleVoxel(LOOP_MS - 1, 0.65, pose))
  }
  for (let time = 0; time < LOOP_MS; time += 100) {
    assert.equal(sampleVoxel(time, 0).wind, 0)
  }
})
