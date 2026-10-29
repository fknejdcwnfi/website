import assert from 'node:assert/strict'
import test from 'node:test'
import { readStageOptions } from '../../src/features/portrait/animation/stageOptions.ts'
import { LOOP_MS, sampleVoxel } from '../../src/archive/voxel/voxelTimeline.ts'

test('the default stage is the faithful2D pixel portrait with safe motion controls', () => {
  assert.deepEqual(readStageOptions(''), {
    style: 'portrait',
    debug: false,
    frozenPose: null,
    wind: 1,
    speed: 1,
    seed: 7,
    theme: 'midnight',
    direction: 1,
    gust: 0.35,
    stiffness: 18,
    damping: 5,
    pixel: 256,
    paused: false,
    timeMs: null,
  })
})

test('portrait, voxel, legacy, debug and supported themes remain explicit URL options', () => {
  const legacy = readStageOptions('?style=legacy&debug=1&pose=5')
  assert.equal(legacy.style, 'legacy')
  assert.equal(legacy.debug, true)
  assert.equal(legacy.frozenPose, 5)
  assert.equal(readStageOptions('?style=portrait').style, 'portrait')
  assert.equal(readStageOptions('?style=voxel').style, 'voxel')
  for (const theme of ['midnight', 'emerald', 'amethyst']) {
    assert.equal(readStageOptions(`?theme=${theme}`).theme, theme)
  }
  const unknown = readStageOptions('?style=unknown&debug=true&theme=unknown')
  assert.equal(unknown.style, 'portrait')
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
    assert.equal(options.wind, 1)
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

test('physics controls retain finite signed direction and bounded solver values', () => {
  const low = readStageOptions('?direction=-20&gust=-20&stiffness=-20&damping=-20')
  assert.equal(low.direction, -1)
  assert.equal(low.gust, 0.1)
  assert.equal(low.stiffness, 5)
  assert.equal(low.damping, 1)
  const high = readStageOptions('?direction=20&gust=20&stiffness=200&damping=200')
  assert.equal(high.direction, 1)
  assert.equal(high.gust, 2)
  assert.equal(high.stiffness, 40)
  assert.equal(high.damping, 12)
  const custom = readStageOptions('?direction=-0.5&gust=0.8&stiffness=22&damping=7')
  assert.equal(custom.direction, -0.5)
  assert.equal(custom.gust, 0.8)
  assert.equal(custom.stiffness, 22)
  assert.equal(custom.damping, 7)
  for (const value of ['NaN', 'Infinity', '-Infinity', 'wrong', '']) {
    const options = readStageOptions(`?direction=${value}&gust=${value}&stiffness=${value}&damping=${value}`)
    assert.equal(options.direction, 1)
    assert.equal(options.gust, 0.35)
    assert.equal(options.stiffness, 18)
    assert.equal(options.damping, 5)
  }
})

test('logical pixel resolutions are restricted to the three reviewed grids', () => {
  for (const pixel of [192, 256, 320]) {
    assert.equal(readStageOptions(`?pixel=${pixel}`).pixel, pixel)
  }
  for (const pixel of ['', '0', '-256', '193', '1024', 'NaN', 'Infinity', '192px']) {
    assert.equal(readStageOptions(`?pixel=${pixel}`).pixel, 256)
  }
})

test('pause is an explicit static flag and does not implicitly enable debug UI', () => {
  const paused = readStageOptions('?pause=1')
  assert.equal(paused.paused, true)
  assert.equal(paused.debug, false)
  assert.equal(paused.frozenPose, null)
  for (const value of ['0', '', 'true', '2']) {
    assert.equal(readStageOptions(`?pause=${value}`).paused, false)
  }
})

test('deterministic timeline seeking accepts only finite input within the full loop', () => {
  assert.equal(readStageOptions('?t=740').timeMs, 740)
  assert.equal(readStageOptions('?t=800.5').timeMs, 800.5)
  assert.equal(readStageOptions('?t=-20').timeMs, 0)
  assert.equal(readStageOptions('?t=5000').timeMs, 2300)
  assert.equal(readStageOptions('?t=2300').timeMs, 2300)
  for (const value of ['', 'NaN', 'Infinity', '-Infinity', 'wrong']) {
    assert.equal(readStageOptions(`?t=${value}`).timeMs, null)
  }
  assert.equal(readStageOptions('').timeMs, null)
  const frozen = readStageOptions('?pose=5&t=740')
  assert.equal(frozen.frozenPose, 5)
  assert.equal(frozen.timeMs, 740, 'parser retains both controls; the player gives pose priority')
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
