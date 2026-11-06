import assert from 'node:assert/strict'
import test from 'node:test'
import { BASE_SCENE_RESOLUTION, MAX_SCENE_RESOLUTION,
  resolveSceneResolution } from '../../src/features/poeticPixel/presentation/resolution.ts'

test('scene backing follows physical circle size while retaining the current minimum', () => {
  assert.deepEqual(resolveSceneResolution(534, 1), { width: 1432, height: 1068, scale: 4 })
  assert.deepEqual(resolveSceneResolution(534, 2), { width: 1432, height: 1068, scale: 4 })
  assert.deepEqual(resolveSceneResolution(534, 3), { width: 2148, height: 1602, scale: 6 })
  assert.deepEqual(resolveSceneResolution(534, 4), { width: 2864, height: 2136, scale: 8 })
})

test('narrow high-DPR mobile circles avoid unnecessary desktop-sized surfaces', () => {
  assert.equal(resolveSceneResolution(354, 3), BASE_SCENE_RESOLUTION)
  assert.deepEqual(resolveSceneResolution(354, 4), { width: 2148, height: 1602, scale: 6 })
  assert.equal(resolveSceneResolution(267, 4), BASE_SCENE_RESOLUTION)
})

test('an explicit low-memory hint caps optional growth and unknown memory remains neutral', () => {
  for (const memory of [.5, 1, 2]) assert.equal(resolveSceneResolution(534, 4, memory), BASE_SCENE_RESOLUTION)
  for (const memory of [undefined, NaN, Infinity, 0, -1, 4, 8]) {
    assert.equal(resolveSceneResolution(534, 4, memory), MAX_SCENE_RESOLUTION)
  }
})

test('malformed sizing stays bounded with finite source-aspect output', () => {
  for (const size of [NaN, Infinity, -1, 0, 354, 534, Number.MAX_VALUE]) {
    for (const dpr of [NaN, Infinity, -1, 0, 1, 4, Number.MAX_VALUE]) {
      const result = resolveSceneResolution(size, dpr)
      assert.ok(Number.isFinite(result.width) && Number.isFinite(result.height))
      assert.ok(result.width >= 1432 && result.width <= 2864)
      assert.ok(result.height >= 1068 && result.height <= 2136)
      assert.equal(result.width * 267, result.height * 358)
      assert.ok([4, 6, 8].includes(result.scale))
    }
  }
})
