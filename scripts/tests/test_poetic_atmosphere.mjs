import assert from 'node:assert/strict'
import test from 'node:test'
import { POETIC_PETALS, POETIC_PETAL_LAYERS, POETIC_PETAL_PERIOD_MS,
  poeticPetalFaceVisibility, samplePoeticPetal } from '../../src/features/poeticPixel/atmosphere/petals.ts'
import { POETIC_SNOW_PARTICLES } from '../../src/features/poeticPixel/atmosphere/snow.ts'
import { PETAL_PALETTE, PETAL_SPRITE_CELL, PETAL_SPRITE_ATLAS_WIDTH, PETAL_SPRITE_ATLAS_HEIGHT,
  makePetalSpritePixels } from '../../src/features/poeticPixel/atmosphere/petalSprites.ts'
import { createPoeticPetalPainter } from '../../src/features/poeticPixel/atmosphere/petalRenderer.ts'

const shortestAngle = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

test('the initial circle has recognizable middle and near petals alongside a stronger snow field', () => {
  assert.equal(POETIC_PETALS.length, 48)
  assert.equal(POETIC_SNOW_PARTICLES.length, 384)
  assert.deepEqual(POETIC_PETAL_LAYERS, { far: 20, middle: 18, near: 10 })
  for (const time of [0, 1000, 5000, 13000, 29000, 47000, 71000, 95000]) {
    const visible = POETIC_PETALS.map((_, index) => samplePoeticPetal(index, time))
      .filter(petal => Math.hypot(petal.x - 179, petal.y - 133.5) < 133.5 && petal.alpha > .25)
    assert.ok(visible.length >= 12 && visible.length <= 28, `${time}: ${visible.length}`)
    assert.ok(visible.filter(petal => petal.depth !== 'far').length >= 7, `No clear petals at ${time}`)
    assert.ok(visible.some(petal => petal.depth === 'near'))
  }
  assert.ok(Object.isFrozen(POETIC_PETALS) && POETIC_PETALS.every(Object.isFrozen))
})

test('petals descend smoothly with the breeze, including their96s seam, without sudden alpha flashes', () => {
  for (let time = -1; time < POETIC_PETAL_PERIOD_MS + 1; time += 491) {
    for (let index = 0; index < POETIC_PETALS.length; index++) {
      const a = samplePoeticPetal(index, time)
      const b = samplePoeticPetal(index, time + 1000 / 60)
      assert.ok(b.unwrappedY > a.unwrappedY, `Upward jump ${time}/${index}`)
      assert.ok(b.unwrappedX > a.unwrappedX, `Opposing breeze ${time}/${index}`)
      assert.ok(b.unwrappedY - a.unwrappedY < .24)
      assert.ok(b.unwrappedX - a.unwrappedX < .35)
      assert.ok(Math.abs(a.alpha - b.alpha) < .06, `Opacity flash ${time}/${index}`)
      assert.ok(Math.abs(shortestAngle(a.angle, b.angle)) < .02, `Turn jumped ${time}/${index}`)
      assert.ok(Math.abs(a.tumble - b.tumble) < .015)
    }
  }
  for (let index = 0; index < POETIC_PETALS.length; index++) {
    const a = samplePoeticPetal(index, POETIC_PETAL_PERIOD_MS - 1)
    const b = samplePoeticPetal(index, POETIC_PETAL_PERIOD_MS + 1)
    assert.ok(b.unwrappedY > a.unwrappedY && b.unwrappedX > a.unwrappedX)
    assert.ok(Math.abs(shortestAngle(a.angle, b.angle)) < .01)
  }
})

test('weather is independent of the1.28s character loop and handles safe high-resolution sampling', () => {
  const a = samplePoeticPetal(7, 3), b = samplePoeticPetal(7, 19), c = samplePoeticPetal(7, 1283)
  assert.notEqual(a.y, b.y)
  assert.notEqual(a.y, c.y)
  for (const time of [-1, 0, 1280, 28817]) {
    const p = samplePoeticPetal(19, time), q = samplePoeticPetal(19, time + POETIC_PETAL_PERIOD_MS)
    for (const key of ['x', 'y', 'alpha', 'tumble']) assert.ok(Math.abs(p[key] - q[key]) < 1e-9)
    assert.ok(Math.abs(shortestAngle(p.angle, q.angle)) < 1e-9)
  }
  const normal = samplePoeticPetal(3, 193), hd = samplePoeticPetal(3, 193, 2864, 2136)
  assert.equal(hd.x, normal.x * 8); assert.equal(hd.y, normal.y * 8)
  assert.equal(hd.alpha, normal.alpha)
  for (const time of [NaN, Infinity, -Infinity, -1e10, 1e10]) {
    const p = samplePoeticPetal(3, time, NaN, -1)
    assert.ok(Object.values(p).every(value => typeof value !== 'number' || Number.isFinite(value)))
  }
})

test('the expression stays readable without a hard face-shaped exclusion', () => {
  assert.ok(poeticPetalFaceVisibility(179, 98) > 0)
  assert.ok(poeticPetalFaceVisibility(179, 98) < .09)
  assert.ok(poeticPetalFaceVisibility(35, 95) > .99)
  for (let x = 90; x < 270; x += .1) {
    assert.ok(Math.abs(poeticPetalFaceVisibility(x, 98) - poeticPetalFaceVisibility(x + .1, 98)) < .004)
  }
})

test('the cached petal atlas uses pink binary-alpha silhouettes at every angle and tumble pose', () => {
  const pixels = makePetalSpritePixels()
  assert.equal(pixels.length, PETAL_SPRITE_ATLAS_WIDTH * PETAL_SPRITE_ATLAS_HEIGHT * 4)
  const allowed = new Set(PETAL_PALETTE.map(color => color.slice(1)))
  for (let p = 0; p < pixels.length; p += 4) {
    assert.ok(pixels[p + 3] === 0 || pixels[p + 3] === 255)
    if (pixels[p + 3]) {
      const color = [...pixels.slice(p, p + 3)].map(value => value.toString(16).padStart(2, '0')).join('')
      assert.ok(allowed.has(color))
      assert.ok(pixels[p] > pixels[p + 1] + 10, 'Petal lost its visible pink color')
    }
  }
  const area = (row, rotation) => {
    let total = 0
    for (let y = 0; y < PETAL_SPRITE_CELL; y++) for (let x = 0; x < PETAL_SPRITE_CELL; x++) {
      total += pixels[((row * PETAL_SPRITE_CELL + y) * PETAL_SPRITE_ATLAS_WIDTH + rotation * PETAL_SPRITE_CELL + x) * 4 + 3] > 0
    }
    return total
  }
  for (let row = 0; row < 9; row++) for (let rotation = 0; rotation < 16; rotation++) assert.ok(area(row, rotation) > 0)
  assert.ok(area(8, 0) > area(6, 0), 'Face-on petal should open from its edge-on pose')
  assert.ok(area(8, 0) > area(2, 0), 'Foreground petals should be larger than distant petals')
})

test('petal drawing caches one sprite atlas, respects entry opacity and restores Canvas state', () => {
  let allocations = 0, uploads = 0
  const canvas = { width: 0, height: 0, getContext() { return {
    createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) } },
    putImageData() { uploads++ },
  } } }
  const painter = createPoeticPetalPainter(() => { allocations++; return canvas })
  const draws = [], stack = []
  const context = {
    globalAlpha: .37, imageSmoothingEnabled: true,
    save() { stack.push([this.globalAlpha, this.imageSmoothingEnabled]) },
    restore() { [this.globalAlpha, this.imageSmoothingEnabled] = stack.pop() },
    drawImage(...args) { draws.push({ args, alpha: this.globalAlpha }) },
  }
  for (const time of [0, 19, 1280]) painter(context, time, 2864, 2136, .4)
  assert.equal(allocations, 1); assert.equal(uploads, 1)
  assert.ok(draws.length >= 80 && draws.length <= 144)
  assert.equal(context.globalAlpha, .37); assert.equal(context.imageSmoothingEnabled, true)
  assert.equal(stack.length, 0)
  for (const { args, alpha } of draws) {
    assert.equal(args[0], canvas)
    assert.ok(args.slice(1).every(Number.isInteger))
    assert.equal(args[7], PETAL_SPRITE_CELL * 8); assert.equal(args[8], PETAL_SPRITE_CELL * 8)
    assert.ok(alpha >= 0 && alpha <= .4)
  }
})
