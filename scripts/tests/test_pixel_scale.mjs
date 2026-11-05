import assert from 'node:assert/strict'
import test from 'node:test'
import { scale2xPixels } from '../../src/features/referenceScene/pixelArtScale.ts'

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
