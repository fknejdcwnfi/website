import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { loadSceneAssets } from '../../src/features/referenceScene/loadScene.ts'
import { sampleScene } from '../../src/features/referenceScene/sceneTimeline.ts'
import { getMediaQuery, listenMediaQuery, observeIntersection } from '../../src/features/referenceScene/browserSignals.ts'

const root = new URL('../../', import.meta.url)
const executable = source => stripTypeScriptTypes(source, { mode: 'transform' })
  .replace(/^import\s+[\s\S]*?\sfrom\s+['"][^'"]+['"];?\s*$/gm, '')

test('real scene effect bounds retries even when every renderer fails after its first successful frame', async () => {
  const globals = ['window', 'document', 'localStorage', 'Image', 'requestAnimationFrame', 'cancelAnimationFrame']
  const saved = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const timers = new Map(), rafs = new Map(), online = new Set(), visibility = new Set(), media = new Set()
  let nextId = 1, now = 0, created = 0, destroyed = 0
  const query = { matches: false, addEventListener(type, listener) { media.add(listener) },
    removeEventListener(type, listener) { media.delete(listener) } }
  const browserWindow = {
    matchMedia: () => query, location: { href: 'http://localhost/', origin: 'http://localhost' },
    addEventListener(type, listener) { if (type === 'online') online.add(listener) },
    removeEventListener(type, listener) { if (type === 'online') online.delete(listener) },
    setTimeout(fn, delay) { const id = nextId++; timers.set(id, { fn, delay, at: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  }
  const canvas = { dataset: {}, width: 1432, height: 1068,
    getContext: () => ({ imageSmoothingEnabled: false, clearRect() {}, drawImage() {} }) }
  const definition = { version: 1, width: 1432, height: 1068, description: 'Lifecycle fixture',
    canonical: { src: '/canonical.png', width: 1432, height: 1068 }, motionSource: 'source-timing' }
  const createRenderer = () => {
    created++
    let paints = 0
    return { paint() { if (++paints === 2) throw new Error('Failure after a successful frame') }, destroy() { destroyed++ } }
  }
  const slots = []
  let cursor = 0, pending = [], rerender = false, ReferenceScene
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const hooks = {
    useRef(initial) { const id = cursor++; return slots[id] ??= { current: initial } },
    useState(initial) {
      const id = cursor++
      if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial
      return [slots[id], value => { slots[id] = typeof value === 'function' ? value(slots[id]) : value; rerender = true }]
    },
    useEffect(effect, deps) {
      const id = cursor++, previous = slots[id]
      if (!same(previous?.deps, deps)) pending.push(() => { previous?.cleanup?.(); slots[id] = { deps, cleanup: effect() } })
    },
    useLayoutEffect(effect, deps) { return hooks.useEffect(effect, deps) },
  }
  const render = () => {
    cursor = 0; pending = []; rerender = false
    ReferenceScene({ definition, createRenderer })
    slots[0].current ??= canvas
    slots[1].current ??= {}
    for (const effect of pending) effect()
  }
  const settle = async () => {
    for (let pass = 0; pass < 16; pass++) { await Promise.resolve(); if (rerender) render() }
  }
  try {
    const mocks = { window: browserWindow,
      document: { hidden: false, addEventListener(type, listener) { if (type === 'visibilitychange') visibility.add(listener) },
        removeEventListener(type, listener) { if (type === 'visibilitychange') visibility.delete(listener) } },
      localStorage: { getItem: () => null },
      Image: class { naturalWidth = 1432; naturalHeight = 1068
        set src(value) { queueMicrotask(() => this.onload?.()) } removeAttribute() {} },
      requestAnimationFrame(fn) { const id = nextId++; rafs.set(id, fn); return id },
      cancelAnimationFrame(id) { rafs.delete(id) },
    }
    for (const [key, value] of Object.entries(mocks)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    const playerSource = executable(readFileSync(new URL('src/features/referenceScene/ScenePlayer.ts', root), 'utf8'))
      .replace('export class ScenePlayer', 'class ScenePlayer')
    const ScenePlayer = new Function('loadSceneAssets', 'sampleScene', 'getMediaQuery', 'listenMediaQuery',
      playerSource + '\nreturn ScenePlayer')(loadSceneAssets, sampleScene, getMediaQuery, listenMediaQuery)
    // Execute the actual hook/effect body, omitting only its JSX presentation.
    const sceneSource = executable(readFileSync(new URL('src/features/referenceScene/ReferenceScene.tsx', root), 'utf8')
      .split('  const failed = state.playback')[0] + '  return null\n}\n')
      .replace('export default function ReferenceScene', 'function ReferenceScene')
    const dependencies = { ...hooks, ScenePlayer, useSceneViewport: () => ({}),
      useSceneResolution: () => ({ width: 1432, height: 1068 }), getMediaQuery, listenMediaQuery, observeIntersection,
      attachPoeticBootstrap() {}, detachPoeticBootstrap() {}, pausePoeticBootstrap() {}, playPoeticBootstrap() {}, releasePoeticBootstrap() {} }
    ReferenceScene = new Function(...Object.keys(dependencies), sceneSource + '\nreturn ReferenceScene')(...Object.values(dependencies))
    render(); await settle()
    const delays = []
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal(rafs.size, 1, 'each recovered player must actually start a dynamic frame')
      const [frameId, frame] = [...rafs][0]; rafs.delete(frameId); now += 16; frame(now)
      await settle()
      const retry = [...timers].find(([, timer]) => timer.delay === 2000 || timer.delay === 5000)
      delays.push(retry?.[1].delay ?? null)
      if (retry) { timers.delete(retry[0]); now = retry[1].at; retry[1].fn(); await settle() }
    }
    assert.deepEqual(delays, [2000, 5000, null])
    assert.equal(created, 3)
    assert.equal(destroyed, 3)
    assert.equal(rafs.size, 0)
    assert.equal(timers.size, 0)
    // A new browser online event is an explicit recovery opportunity, so it
    // resets the budget without reviving any already-destroyed renderer.
    for (const listener of [...online]) listener()
    await settle()
    assert.equal(created, 4)
    const [frameId, frame] = [...rafs][0]; rafs.delete(frameId); now += 16; frame(now)
    await settle()
    assert.ok([...timers.values()].some(timer => timer.delay === 2000))
  } finally {
    for (const slot of slots) slot?.cleanup?.()
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
  assert.equal(created, destroyed)
  assert.equal(timers.size, 0)
  assert.equal(rafs.size, 0)
  assert.equal(online.size + visibility.size + media.size, 0)
})
