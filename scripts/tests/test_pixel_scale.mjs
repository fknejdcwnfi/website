import assert from 'node:assert/strict'
import test from 'node:test'
import { scale2xPixels } from '../../src/features/referenceScene/pixelArtScale.ts'
import { createFrameReconstruction } from '../../src/features/poeticPixel/presentation/frameReconstruction.ts'

const rgba = words => new Uint8ClampedArray(new Uint32Array(words).buffer)
const words = bytes => Array.from(new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4))
const color = (r, g, b, a = 255) => (a << 24 | b << 16 | g << 8 | r) >>> 0

test('Scale2x improves a diagonal with source colors instead of interpolated blur', () => {
  const light = color(224, 205, 190), ink = color(44, 39, 55)
  const source = rgba([light, light, light, ink, light, light, ink, ink, light])
  const output = words(scale2xPixels(source, 3, 3))
  assert.deepEqual(output.slice(3 * 6 + 2, 3 * 6 + 4), [ink, light])
  assert.ok(output.every(value => value === light || value === ink))
  assert.notDeepEqual(output, words(rgba(Array.from({ length: 6 }, (_, y) => Array.from({ length: 6 }, (_, x) => words(source)[Math.floor(y / 2) * 3 + Math.floor(x / 2)])).flat())))
})

test('every original pixel is recoverable as the unique most frequent color of its 2x2 block', () => {
  // Exhaust the five-neighbor topology over three distinct colors. This covers
  // corners, crossings and edges, not only the current portrait's pixel values.
  const palette = [color(13, 41, 73), color(213, 184, 151), color(86, 145, 212)]
  for (let encoded = 0; encoded < 3 ** 5; encoded++) {
    let value = encoded
    const [north, west, center, east, south] = Array.from({ length: 5 }, () => { const c = palette[value % 3]; value = Math.floor(value / 3); return c })
    const output = words(scale2xPixels(rgba([center, north, center, west, center, east, center, south, center]), 3, 3))
    const block = [output[14], output[15], output[20], output[21]]
    const counts = new Map()
    block.forEach(c => counts.set(c, (counts.get(c) ?? 0) + 1))
    assert.ok((counts.get(center) ?? 0) >= 2)
    assert.ok([...counts].every(([c, n]) => c === center || n < counts.get(center)))
  }
})

test('single pixels, image boundaries and transparent holes retain exact RGBA colors', () => {
  const transparent = color(0, 0, 0, 0), partial = color(255, 99, 11, 128), opaque = color(24, 55, 77)
  assert.deepEqual(words(scale2xPixels(rgba([partial]), 1, 1)), [partial, partial, partial, partial])
  const output = words(scale2xPixels(rgba([opaque, opaque, opaque, opaque, transparent, opaque, opaque, opaque, opaque]), 3, 3))
  assert.ok(output.every(c => c === opaque || c === transparent))
  assert.deepEqual([output[14], output[15], output[20], output[21]], [transparent, transparent, transparent, transparent])
})

test('reusable output and unaligned typed views produce identical pixels without buffer overlap', () => {
  const source = rgba([color(8, 16, 32), color(64, 128, 192)])
  const expected = scale2xPixels(source, 2, 1), destination = new Uint8ClampedArray(expected.length)
  assert.equal(scale2xPixels(source, 2, 1, destination), destination)
  assert.deepEqual(destination, expected)
  const unaligned = new Uint8ClampedArray(new ArrayBuffer(source.length + 1), 1)
  unaligned.set(source)
  const unalignedTarget = new Uint8ClampedArray(new ArrayBuffer(expected.length + 1), 1)
  scale2xPixels(unaligned, 2, 1, unalignedTarget)
  assert.deepEqual(unalignedTarget, expected)
  const overlapping = new ArrayBuffer(expected.length)
  assert.throws(() => scale2xPixels(new Uint8ClampedArray(overlapping, 0, source.length), 2, 1, new Uint8ClampedArray(overlapping)), /overlap/)
  for (const [width, height] of [[0, 1], [2.5, 1], [Infinity, 1], [2048, 2048]]) {
    assert.throws(() => scale2xPixels(source, width, height), RangeError)
  }
  assert.throws(() => scale2xPixels(source, 3, 1), /buffers/)
})

const withImageData = run => {
  const previous = globalThis.ImageData
  let allocations = 0
  globalThis.ImageData = class {
    constructor(width, height) {
      allocations++
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
  try { return run(() => allocations) }
  finally {
    if (previous === undefined) delete globalThis.ImageData
    else globalThis.ImageData = previous
  }
}

const frameContext = (width, height) => ({
  canvas: { width, height }, imageSmoothingEnabled: true, uploads: [],
  putImageData(pixels, x, y) { assert.equal(x, 0); assert.equal(y, 0); this.uploads.push(pixels) },
})

test('atlas tiles exactly match two existing Scale2x passes for every five-neighbor topology', () => withImageData(() => {
  const palette = [color(13, 41, 73), color(213, 184, 151, 128), color(0, 0, 0, 0)]
  for (let encoded = 0; encoded < 3 ** 5; encoded++) {
    let value = encoded
    const [north, west, center, east, south] = Array.from({ length: 5 }, () => {
      const entry = palette[value % 3]; value = Math.floor(value / 3); return entry
    })
    const native = rgba([center, north, center, west, center, east, center, south, center])
    const atlasWords = new Uint32Array(5 * 5).fill(color(255, 0, 200))
    for (let y = 0; y < 3; y++) atlasWords.set(new Uint32Array(native.buffer, y * 3 * 4, 3), (y + 1) * 5 + 1)
    const cache = createFrameReconstruction({ data: new Uint8ClampedArray(atlasWords.buffer), width: 5, height: 5 }, 3, 3)
    const context = frameContext(12, 12)
    cache.paint(context, 1, 1)
    assert.deepEqual(context.uploads[0].data, scale2xPixels(scale2xPixels(native, 3, 3), 6, 6), `Topology ${encoded}`)
    assert.equal(context.imageSmoothingEnabled, false)
    cache.destroy()
  }
}))

test('strided atlas reads preserve exact tile boundaries, alpha and aligned buffer offsets', () => withImageData(() => {
  const palette = [color(0, 0, 0, 0), color(89, 123, 177), color(242, 191, 207), color(250, 241, 230, 128)]
  for (const [width, height] of [[1, 1], [2, 1], [1, 4], [4, 1], [3, 4], [7, 6]]) {
    const atlasWidth = width * 3 + 2, atlasHeight = height * 2 + 2
    const storage = new Uint32Array(atlasWidth * atlasHeight + 3)
    const atlasWords = storage.subarray(2, storage.length - 1)
    for (let p = 0; p < atlasWords.length; p++) atlasWords[p] = palette[((p * 23) ^ (p >>> 2)) % palette.length]
    const cache = createFrameReconstruction({ data: new Uint8ClampedArray(atlasWords.buffer, 8, atlasWords.byteLength), width: atlasWidth, height: atlasHeight }, width, height)
    const context = frameContext(width * 4, height * 4)
    for (const [sx, sy] of [[0, 0], [width + 1, 1], [atlasWidth - width, atlasHeight - height]]) {
      const native = new Uint32Array(width * height)
      for (let y = 0; y < height; y++) native.set(atlasWords.subarray((sy + y) * atlasWidth + sx, (sy + y) * atlasWidth + sx + width), y * width)
      cache.paint(context, sx, sy)
      const bytes = new Uint8ClampedArray(native.buffer)
      assert.deepEqual(context.uploads.at(-1).data, scale2xPixels(scale2xPixels(bytes, width, height), width * 2, height * 2), `${width}×${height} at ${sx},${sy}`)
    }
    cache.destroy()
  }
}))

test('reconstruction reuses two output slots in least-recently-used order and disposes idempotently', () => withImageData(allocations => {
  const colors = [color(15, 40, 80), color(220, 180, 150), color(240, 200, 215)]
  const cache = createFrameReconstruction({ data: rgba(colors), width: 3, height: 1 }, 1, 1)
  const context = frameContext(4, 4)
  cache.paint(context, 0, 0, 'first')
  const first = context.uploads.at(-1)
  cache.paint(context, 1, 0, 'second')
  const second = context.uploads.at(-1)
  assert.notEqual(first, second)
  cache.paint(context, 0, 0, 'first')
  assert.equal(context.uploads.at(-1), first)
  cache.paint(context, 2, 0, 'third')
  assert.equal(context.uploads.at(-1), second)
  assert.deepEqual(words(second.data), Array(16).fill(colors[2]))
  cache.paint(context, 0, 0, 'first')
  assert.equal(context.uploads.at(-1), first)
  cache.paint(context, 1, 0, 'second')
  assert.equal(context.uploads.at(-1), second)
  assert.deepEqual(words(second.data), Array(16).fill(colors[1]))
  cache.paint(context, 1, 0, 'new-key')
  assert.equal(context.uploads.at(-1), first)
  assert.deepEqual(words(first.data), Array(16).fill(colors[1]))
  assert.equal(allocations(), 2)
  cache.destroy(); cache.destroy()
  assert.throws(() => cache.paint(context), /disposed/)
  assert.equal(allocations(), 2)
}))

test('native atlas validation rejects mismatched buffers and tiles outside the source', () => withImageData(() => {
  const valid = { data: rgba([color(1, 2, 3), color(4, 5, 6)]), width: 2, height: 1 }
  for (const [width, height] of [[0, 1], [1.5, 1], [Infinity, 1], [2048, 2048]]) {
    assert.throws(() => createFrameReconstruction(valid, width, height), RangeError)
  }
  for (const atlas of [
    { ...valid, width: 1 }, { ...valid, height: 1.5 }, { ...valid, width: Infinity },
    { ...valid, data: new Uint8Array(8) }, { ...valid, data: new Uint8ClampedArray(7) },
    { ...valid, data: new Uint8ClampedArray(new ArrayBuffer(9), 1) },
    { ...valid, width: 8193 }, { ...valid, width: 4096, height: 4096 },
  ]) assert.throws(() => createFrameReconstruction(atlas, 1, 1), RangeError)
  assert.throws(() => createFrameReconstruction(valid, 3, 1), RangeError)
  const cache = createFrameReconstruction(valid, 1, 1), context = frameContext(4, 4)
  for (const [sx, sy] of [[-1, 0], [0.5, 0], [NaN, 0], [Infinity, 0], [2, 0], [0, 1]]) {
    assert.throws(() => cache.paint(context, sx, sy), RangeError)
  }
  assert.throws(() => cache.paint(frameContext(8, 4)), RangeError)
  assert.equal(context.uploads.length, 0)
  cache.destroy()
}))
