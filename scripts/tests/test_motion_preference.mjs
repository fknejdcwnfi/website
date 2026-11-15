import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { sampleScene } from '../../src/features/referenceScene/sceneTimeline.ts'
import { SCENE_MOTION_KEY, readSceneMotion, writeSceneMotion, parserMotionExpression } from '../../src/features/referenceScene/motionPreference.ts'

const withStorage = (storage, run) => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    return run()
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved)
    else delete globalThis.localStorage
  }
}

test('the new scene defaults to motion and only an explicit current static choice pauses', () => {
  for (const value of [null, undefined, '', 'dynamic', 'false', 'true', 'unknown']) {
    withStorage({ getItem(key) { assert.equal(key, SCENE_MOTION_KEY); return value } }, () => assert.equal(readSceneMotion(), true))
  }
  withStorage({ getItem(key) { assert.equal(key, SCENE_MOTION_KEY); return 'static' } }, () => assert.equal(readSceneMotion(), false))
  const values = new Map([['vermouth-motion-enabled', 'false']])
  withStorage({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, () => {
    assert.equal(readSceneMotion(), true, 'the former follow-system flag is not an explicit pause')
    writeSceneMotion(false); assert.equal(values.get(SCENE_MOTION_KEY), 'static'); assert.equal(readSceneMotion(), false)
    writeSceneMotion(true); assert.equal(values.get(SCENE_MOTION_KEY), 'dynamic'); assert.equal(readSceneMotion(), true)
  })
})

test('storage failures cannot stop the default scene or the in-memory control', () => {
  withStorage({ getItem() { throw Error('Unavailable') }, setItem() { throw Error('Unavailable') } }, () => {
    assert.equal(readSceneMotion(), true)
    assert.doesNotThrow(() => writeSceneMotion(false))
    assert.doesNotThrow(() => writeSceneMotion(true))
  })
  withStorage(undefined, () => assert.equal(readSceneMotion(), true))
})

test('the parser executes the same self-contained reader without module closures', () => {
  const expression = parserMotionExpression()
  for (const value of [null, 'dynamic', 'static', 'invalid']) {
    const storage = { getItem(key) { assert.equal(key, SCENE_MOTION_KEY); return value } }
    const expected = withStorage(storage, readSceneMotion)
    assert.equal(runInNewContext(expression, { localStorage: storage }), expected)
  }
  assert.equal(runInNewContext(expression, {}), true)
  assert.equal(runInNewContext(expression, { get localStorage() { throw Error('Blocked') } }), true)
})

test('explicit pause keeps one prepared renderer and source phase; fixed inspection remains static', async () => {
  const globals = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame']
  const saved = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const rafs = new Map(), events = new Set(), samples = []
  let id = 0, created = 0, destroyed = 0, hidden = false, canonicalPaints = 0
  const context = { imageSmoothingEnabled: false, clearRect() {}, drawImage() { canonicalPaints++ } }
  const definition = { width: 716, height: 534 }
  const makeCanvas = () => ({ width: 0, height: 0, dataset: {}, getContext: () => context })
  const factory = () => { created++; return { paint(ctx, sample) { samples.push(sample.elapsedMs) }, destroy() { destroyed++ } } }
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout: () => ++id, clearTimeout() {} } })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { get hidden() { return hidden }, addEventListener(type, fn) { events.add(fn) }, removeEventListener(type, fn) { events.delete(fn) } } })
    Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: fn => { const next = ++id; rafs.set(next, fn); return next } })
    Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: key => rafs.delete(key) })
    const source = stripTypeScriptTypes(readFileSync(new URL('../../src/features/referenceScene/ScenePlayer.ts', import.meta.url), 'utf8'), { mode: 'transform' })
      .replace(/^import\s+[\s\S]*?\sfrom\s+['"][^'"]+['"];?\s*$/gm, '').replace('export class ScenePlayer', 'class ScenePlayer')
    const ScenePlayer = new Function('loadSceneAssets', 'sampleScene', 'readSceneMotion', source + '\nreturn ScenePlayer')(
      async () => ({ canonical: {} }), sampleScene, () => true)
    const settle = async () => { for (let n = 0; n < 12; n++) await Promise.resolve() }
    const canvas = makeCanvas()
    const player = new ScenePlayer(canvas, definition, factory, { initialElapsedMs: () => 640 })
    await settle()
    assert.equal(canvas.dataset.playback, 'looping')
    assert.equal(samples[0], 640)
    const frame = time => { const [key, fn] = [...rafs][0]; rafs.delete(key); fn(time) }
    frame(100); frame(180)
    const before = samples.at(-1)
    const sampleCount = samples.length, canonicalCount = canonicalPaints
    player.setMotionEnabled(false)
    assert.equal(canvas.dataset.playback, 'static')
    assert.equal(rafs.size, 0)
    assert.equal(samples.length, sampleCount, 'pausing retains the exact displayed frame')
    assert.equal(canonicalPaints, canonicalCount, 'pausing does not snap to the canonical first frame')
    player.setOutputSize(1432, 1068)
    assert.equal(samples.at(-1), before, 'a paused resize repaints the same source phase once')
    assert.equal(canonicalPaints, canonicalCount)
    player.setMotionEnabled(true)
    assert.equal(canvas.dataset.playback, 'looping')
    assert.equal(samples.at(-1), before, 'resuming does not reset the source phase')
    assert.equal(created, 1)
    player.setViewportVisible(false)
    assert.equal(canvas.dataset.playback, 'suspended'); assert.equal(rafs.size, 0)
    player.setViewportVisible(true)
    hidden = true; for (const event of events) event()
    assert.equal(canvas.dataset.playback, 'suspended'); assert.equal(rafs.size, 0)
    hidden = false; for (const event of events) event()
    player.destroy()
    assert.equal(destroyed, 1)
    assert.equal(events.size, 0)
    assert.equal(rafs.size, 0)
    const fixedCanvas = makeCanvas()
    const fixed = new ScenePlayer(fixedCanvas, definition, factory, { timeMs: 80, motionEnabled: true })
    await settle()
    assert.equal(fixedCanvas.dataset.playback, 'static')
    assert.equal(samples.at(-1), 80)
    assert.equal(rafs.size, 0)
    fixed.destroy()
  } finally {
    for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value)
      else delete globalThis[key]
    }
  }
})
