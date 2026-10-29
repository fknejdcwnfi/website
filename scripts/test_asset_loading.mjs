import assert from 'node:assert/strict'
import test from 'node:test'
import { loadImage } from '../src/character/portraitAsset.ts'

function installImageMock(t) {
  const originalImage = globalThis.Image
  const realSetTimeout = globalThis.setTimeout
  const realClearTimeout = globalThis.clearTimeout
  const pendingTimers = new Set()
  const images = []
  class MockImage {
    onload = null
    onerror = null
    naturalWidth = 256
    naturalHeight = 256
    decoding = 'auto'
    src = ''
    removedSource = false
    constructor() { images.push(this) }
    removeAttribute(name) {
      if (name === 'src') { this.src = ''; this.removedSource = true }
    }
  }
  globalThis.Image = MockImage
  globalThis.setTimeout = (callback, milliseconds, ...args) => {
    const timer = realSetTimeout(callback, milliseconds, ...args)
    pendingTimers.add(timer)
    return timer
  }
  globalThis.clearTimeout = (timer) => {
    pendingTimers.delete(timer)
    realClearTimeout(timer)
  }
  t.after(() => {
    for (const timer of pendingTimers) realClearTimeout(timer)
    globalThis.Image = originalImage
    globalThis.setTimeout = realSetTimeout
    globalThis.clearTimeout = realClearTimeout
  })
  return { images, pendingTimers }
}

test('portrait image load resolves a valid image and releases its timeout and handlers', async (t) => {
  const { images, pendingTimers } = installImageMock(t)
  const loaded = loadImage('/portrait.png')
  const image = images[0]
  assert.equal(image.src, '/portrait.png')
  assert.equal(image.decoding, 'async')
  image.onload()
  assert.equal(await loaded, image)
  assert.equal(pendingTimers.size, 0)
  assert.equal(image.onload, null)
  assert.equal(image.onerror, null)
  assert.equal(image.removedSource, false)
})

test('portrait resource errors reject without leaving a pending timeout', async (t) => {
  const { images, pendingTimers } = installImageMock(t)
  const failed = loadImage('/missing.png')
  images[0].onerror()
  await assert.rejects(failed, /Unable to load portrait artwork/)
  assert.equal(pendingTimers.size, 0)
  assert.equal(images[0].onload, null)
  assert.equal(images[0].onerror, null)
})

test('an onload event with no usable pixels is rejected', async (t) => {
  const { images, pendingTimers } = installImageMock(t)
  const failed = loadImage('/invalid.png')
  images[0].naturalWidth = 0
  images[0].onload()
  await assert.rejects(failed, /Invalid portrait artwork/)
  assert.equal(pendingTimers.size, 0)
})

test('a hanging portrait request times out, clears its handlers and removes the pending source', async (t) => {
  const { images, pendingTimers } = installImageMock(t)
  const failed = loadImage('/hanging.png', 5)
  const lateOnload = images[0].onload
  await assert.rejects(failed, /Timed out loading portrait artwork/)
  assert.equal(pendingTimers.size, 0)
  assert.equal(images[0].removedSource, true)
  assert.equal(images[0].onload, null)
  assert.equal(images[0].onerror, null)
  lateOnload()
  await assert.rejects(failed, /Timed out loading portrait artwork/)
})
