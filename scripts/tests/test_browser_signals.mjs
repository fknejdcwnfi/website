import assert from 'node:assert/strict'
import test from 'node:test'
import { getMediaQuery, listenMediaQuery, observeIntersection, observeResize } from '../../src/features/referenceScene/browserSignals.ts'
import { retainPoeticBootstrap, discardPoeticBootstrap } from '../../src/features/poeticPixel/bootstrap.ts'

const withGlobals = (values, run) => {
  const descriptors = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  try {
    for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    return run()
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}

test('optional media queries handle absent and throwing browser APIs', () => {
  withGlobals({ window: {} }, () => assert.equal(getMediaQuery('screen'), null))
  withGlobals({ window: { matchMedia() { throw new Error('Unavailable') } } }, () => assert.equal(getMediaQuery('screen'), null))
  const query = { matches: false }
  withGlobals({ window: { matchMedia(value) { assert.equal(value, 'screen'); return query } } }, () => assert.equal(getMediaQuery('screen'), query))
  assert.doesNotThrow(() => listenMediaQuery(null, () => {})())
})

test('legacy media listeners register and clean up exactly once', () => {
  const listeners = new Set()
  let added = 0, removed = 0, changes = 0
  const query = { addListener(callback) { added++; listeners.add(callback) },
    removeListener(callback) { removed++; listeners.delete(callback) } }
  const stop = listenMediaQuery(query, () => { changes++ })
  for (const listener of listeners) listener()
  assert.equal(changes, 1)
  stop(); stop()
  for (const listener of listeners) listener()
  assert.equal(changes, 1)
  assert.equal(added, 1)
  assert.equal(removed, 1)
})

test('partially registered modern media listeners are removed before legacy fallback', () => {
  const modern = new Set(), legacy = new Set()
  let changes = 0
  const query = {
    addEventListener(type, callback) { assert.equal(type, 'change'); modern.add(callback); throw new Error('Partial registration') },
    removeEventListener(type, callback) { assert.equal(type, 'change'); modern.delete(callback) },
    addListener(callback) { legacy.add(callback) }, removeListener(callback) { legacy.delete(callback) },
  }
  const stop = listenMediaQuery(query, () => { changes++ })
  assert.equal(modern.size, 0)
  assert.equal(legacy.size, 1)
  for (const listener of legacy) listener()
  assert.equal(changes, 1)
  stop(); stop()
  assert.equal(modern.size + legacy.size, 0)
})

test('observer constructor and partial observe failures preserve cleanup and gate queued callbacks', () => {
  for (const [name, observe] of [['IntersectionObserver', observeIntersection], ['ResizeObserver', observeResize]]) {
    withGlobals({ [name]: class { constructor() { throw new Error('Constructor unavailable') } } }, () => {
      const stop = observe({}, () => assert.fail('A failed observer must not call back'))
      assert.doesNotThrow(() => { stop(); stop() })
    })
    let instance, disconnected = 0, calls = 0
    withGlobals({ [name]: class {
      constructor(callback) { this.callback = callback; instance = this }
      observe() { throw new Error('Partial observe failure') }
      disconnect() { disconnected++ }
    } }, () => {
      const stop = observe({}, () => { calls++ })
      assert.equal(disconnected, 1)
      instance.callback([], instance)
      stop(); stop()
      assert.equal(calls, 0)
      assert.equal(disconnected, 1)
    })
  }
})

test('successful observers ignore callbacks after idempotent disconnect', () => {
  for (const [name, observe] of [['IntersectionObserver', observeIntersection], ['ResizeObserver', observeResize]]) {
    let instance, calls = 0, disconnected = 0
    const target = {}
    withGlobals({ [name]: class {
      constructor(callback) { this.callback = callback; instance = this }
      observe(value) { assert.equal(value, target) }
      disconnect() { disconnected++; throw new Error('Cleanup failure') }
    } }, () => {
      const stop = observe(target, () => { calls++ })
      instance.callback([], instance)
      assert.equal(calls, 1)
      assert.doesNotThrow(() => { stop(); stop() })
      instance.callback([], instance)
      assert.equal(calls, 1)
      assert.equal(disconnected, 1)
    })
  }
})

test('boundary bootstrap discard releases the detached original video and is idempotent', () => {
  let pauses = 0, loads = 0, cleanups = 0
  const group = { dataset: { weather: 'visible', motion: 'running' }, isConnected: true,
    getAnimations() { return [] }, remove() { this.isConnected = false } }
  class Video {
    dataset = { ready: 'true' }
    src = '/boot.mp4'
    paused = false
    onloadeddata = () => {}
    closest() { return group }
    remove() { this.isConnected = false }
    pause() { pauses++; this.paused = true }
    hasAttribute() { return Boolean(this.src) }
    removeAttribute() { this.src = '' }
    load() { loads++ }
  }
  const video = new Video()
  const browserWindow = { __vermouthPoeticVideo: video, __vermouthPoeticEntry: group,
    __vermouthPoeticCleanup() { cleanups++ } }
  withGlobals({ HTMLVideoElement: Video, window: browserWindow, document: { getElementById() { return video } } }, () => {
    retainPoeticBootstrap()
    assert.equal(group.isConnected, false)
    discardPoeticBootstrap(); discardPoeticBootstrap()
    assert.equal(video.paused, true)
    assert.equal(video.src, '')
    assert.equal(video.onloadeddata, null)
    assert.equal(group.dataset.weather, 'hidden')
    assert.equal(group.dataset.motion, 'paused')
    assert.equal(browserWindow.__vermouthPoeticVideo, undefined)
    assert.equal(browserWindow.__vermouthPoeticEntry, undefined)
    assert.equal(browserWindow.__vermouthPoeticCleanup, undefined)
    assert.equal(pauses, 1)
    assert.equal(loads, 1)
    assert.equal(cleanups, 1)
  })
})
