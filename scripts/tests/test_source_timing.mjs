import assert from 'node:assert/strict'
import test from 'node:test'
import { compileSourceTiming, sampleSourceTime, validateSourceTiming } from '../../src/features/referenceScene/sourceTiming.ts'
import { fitSceneViewport } from '../../src/features/referenceScene/sceneViewport.ts'

const original = validateSourceTiming({ frameCount: 16, frameDurationsMs: Array(16).fill(80), durationMs: 1280, sourceAnchorCount: 16, loop: 0 })
const smooth = validateSourceTiming({ frameCount: 160, frameDurationsMs: Array(160).fill(8), durationMs: 1280, sourceAnchorCount: 16, loop: 0 })

test('all sixteen source anchors retain the same clock in original and derived sequences', () => {
  for (let anchor = 0; anchor < 16; anchor++) {
    const source = sampleSourceTime(anchor * 80, original), derived = sampleSourceTime(anchor * 80, smooth)
    assert.equal(source.index, anchor)
    assert.equal(derived.index, anchor * 10)
    assert.equal(source.sourceIndex, derived.sourceIndex)
    assert.equal(source.sourceIndex, anchor)
    for (const sample of [source, derived]) {
      assert.equal(sample.localMs, 0)
      assert.equal(sample.phase, 0)
      assert.equal(sample.sourcePhase, 0)
      assert.equal(sample.isSourceAnchor, true)
    }
  }
  const between = sampleSourceTime(635, smooth)
  assert.equal(between.index, 79)
  assert.equal(between.nextIndex, 80)
  assert.equal(between.sourceIndex, 7)
  assert.equal(between.sourcePhase, 75 / 80)
  assert.equal(between.localMs, 3)
  assert.equal(between.phase, 3 / 8)
  assert.equal(between.isSourceAnchor, false)
})

test('the source loop wraps exactly at 1280ms without another wind or blink clock', () => {
  for (const timing of [original, smooth]) {
    for (const time of [0, .125, 79.999, 80, 560, 640, 1279.999]) {
      const a = sampleSourceTime(time, timing), b = sampleSourceTime(time + 1280, timing)
      assert.equal(a.index, b.index)
      assert.ok(Math.abs(a.localMs - b.localMs) < 1e-9)
    }
    assert.equal(sampleSourceTime(1280, timing).index, 0)
    assert.equal(sampleSourceTime(2560, timing).timeMs, 0)
    assert.equal(sampleSourceTime(12000, timing).timeMs, 480)
    assert.equal(sampleSourceTime(12000, timing).sourceIndex, 6)
    assert.equal(sampleSourceTime(24000, timing).sourceIndex, 12)
  }
})

test('negative seeks, fractional boundaries and malformed times stay finite and deterministic', () => {
  assert.equal(sampleSourceTime(-1, original).index, 15)
  assert.equal(sampleSourceTime(-1, original).localMs, 79)
  assert.equal(sampleSourceTime(-1, smooth).index, 159)
  assert.equal(sampleSourceTime(-1280, smooth).timeMs, 0)
  assert.equal(Object.is(sampleSourceTime(-1280, smooth).timeMs, -0), false)
  for (const tiny of [-Number.MIN_VALUE, -1e-20]) {
    const result = sampleSourceTime(tiny, original)
    assert.ok(result.timeMs >= 0 && result.timeMs < 1280)
    assert.ok(result.phase >= 0 && result.phase < 1)
  }
  assert.equal(sampleSourceTime(80 - 1e-10, original).index, 0)
  assert.equal(sampleSourceTime(80, original).index, 1)
  assert.equal(sampleSourceTime(80 + 1e-10, original).index, 1)
  for (const bad of [NaN, Infinity, -Infinity]) {
    const result = sampleSourceTime(bad, original)
    assert.equal(result.index, 0)
    assert.equal(result.precisionLimited, true)
    assert.ok(Object.values(result).every(value => typeof value !== 'number' || Number.isFinite(value)))
  }
})

test('large safe timestamps use represented-value modulo without a false claim of unsafe precision', () => {
  for (const time of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 80, -(Number.MAX_SAFE_INTEGER - 40), 1e12 + .125]) {
    const result = sampleSourceTime(time, original)
    const expected = time % 1280 < 0 ? time % 1280 + 1280 : time % 1280
    assert.equal(result.timeMs, expected)
    assert.equal(result.precisionLimited, false)
  }
  for (const time of [1e100, -1e100, Number.MAX_VALUE]) {
    const result = sampleSourceTime(time, smooth)
    assert.ok(result.timeMs >= 0 && result.timeMs < 1280)
    assert.equal(result.precisionLimited, true)
  }
})

test('variable source frame durations are respected and compiled clocks cannot be mutated', () => {
  const durations = [20, 40, 10]
  const timing = compileSourceTiming(durations, 70)
  durations[0] = 500
  assert.equal(sampleSourceTime(19.999, timing).index, 0)
  assert.equal(sampleSourceTime(20, timing).index, 1)
  assert.equal(sampleSourceTime(59.999, timing).index, 1)
  assert.equal(sampleSourceTime(60, timing).index, 2)
  assert.equal(sampleSourceTime(70, timing).index, 0)
  assert.throws(() => timing.startsMs.push(100), TypeError)
  assert.throws(() => { timing.durationMs = 100 }, TypeError)
  const snake = validateSourceTiming({ frame_count: 2, frame_durations_ms: [30, 70], loop: 0 })
  assert.equal(snake.durationMs, 100)
})

test('invalid timing and ambiguous source manifests are rejected', () => {
  for (const durations of [[], [0], [-1], [Infinity], [NaN], [.00001], [60001], Array(4097).fill(10)]) {
    assert.throws(() => compileSourceTiming(durations))
  }
  assert.throws(() => compileSourceTiming([10], 11), /does not equal/)
  assert.throws(() => compileSourceTiming([10], Infinity))
  assert.throws(() => compileSourceTiming([10, 10, 10], 30, 2), /anchor/)
  for (const metadata of [null, [], {}, { frameCount: 1, frameDurationsMs: ['80'] },
    { frameCount: 2, frameDurationsMs: [80] }, { frameCount: 1, frame_count: 2, frameDurationsMs: [80] },
    { frameCount: 1, frameDurationsMs: [80], frame_durations_ms: [90] },
    { frameCount: 1, frameDurationsMs: [80], loop: -1 },
    { frameCount: 1, frameDurationsMs: [80], sourceAnchorCount: 0 }]) assert.throws(() => validateSourceTiming(metadata))
})

test('native scene cover pixels align to the device grid, including odd cover crops', () => {
  for (const [available, ratio] of [[534, 1], [534, 2], [534, 1.25], [284, 2], [354, 3], [534, 3]]) {
    const left = 17.375, top = 381.25
    const viewport = fitSceneViewport(available, left, top, 358, 267, ratio)
    assert.ok(viewport.diameter <= available + 1e-6)
    assert.ok(viewport.diameter >= available * .82)
    assert.ok(Math.abs(viewport.offsetX) <= .5 / ratio + 1e-6)
    assert.ok(Math.abs(viewport.offsetY) <= .5 / ratio + 1e-6)
    const inset = (available - viewport.diameter) / 2
    const sourceX = (left + inset + viewport.offsetX) * ratio - 91 * viewport.scale / 2
    const sourceY = (top + inset + viewport.offsetY) * ratio
    assert.ok(Math.abs(sourceX - Math.round(sourceX)) < 1e-6)
    assert.ok(Math.abs(sourceY - Math.round(sourceY)) < 1e-6)
    if (viewport.integerScale) assert.equal(viewport.scale, Math.round(viewport.scale))
  }
  assert.equal(fitSceneViewport(534, 0, 0, 358, 267, 1).diameter, 534)
  assert.equal(fitSceneViewport(284, 0, 0, 358, 267, 2).diameter, 267)
  assert.equal(fitSceneViewport(534, 0, 0, 358, 267, 1.5).scale, 3)
})

test('narrow viewports keep a useful native scene size without overflow', () => {
  for (const [available, ratio] of [[354, 1], [354, 2], [354, 3], [180, 1], [240, .75]]) {
    const viewport = fitSceneViewport(available, 0, 0, 358, 267, ratio)
    assert.equal(viewport.integerScale, false)
    assert.equal(viewport.diameter, available)
  }
  const invalid = fitSceneViewport(NaN, NaN, Infinity, -1, 0, 0)
  assert.ok(Object.values(invalid).every(value => typeof value !== 'number' || Number.isFinite(value)))
  assert.ok(invalid.diameter > 0)
})
