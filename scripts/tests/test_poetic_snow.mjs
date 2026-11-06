import assert from 'node:assert/strict'
import test from 'node:test'
import { POETIC_SNOW_LAYERS, POETIC_SNOW_PARTICLES, POETIC_SNOW_PERIOD_MS,
  poeticSnowFaceVisibility, samplePoeticSnow } from '../../src/features/poeticPixel/atmosphere/snow.ts'
import { createPoeticSnowPainter } from '../../src/features/poeticPixel/atmosphere/snowRenderer.ts'

const wrappedDelta = (a, b, period) => {
  const difference = b - a
  return difference > period / 2 ? difference - period : difference < -period / 2 ? difference + period : difference
}

test('the first circle contains distributed snowfall at three depths without a startup ramp', () => {
  assert.equal(POETIC_SNOW_PARTICLES.length, Object.values(POETIC_SNOW_LAYERS).reduce((a, b) => a + b, 0))
  const counts = { far: 0, middle: 0, near: 0 }
  for (let index = 0; index < POETIC_SNOW_PARTICLES.length; index++) {
    const p = samplePoeticSnow(index, 0)
    if (Math.hypot(p.x - 179, p.y - 133.5) < 133.5 && p.alpha > .08) counts[p.depth]++
  }
  assert.ok(counts.far >= 25 && counts.middle >= 20 && counts.near >= 7, JSON.stringify(counts))
  assert.equal(Object.isFrozen(POETIC_SNOW_PARTICLES), true)
})

test('snow always falls downward and stays continuous across recycling and the long-cycle seam', () => {
  let minimum = Infinity, maximum = 0
  for (let time = -60; time < POETIC_SNOW_PERIOD_MS + 60; time += 317) {
    for (let index = 0; index < POETIC_SNOW_PARTICLES.length; index++) {
      const before = samplePoeticSnow(index, time), after = samplePoeticSnow(index, time + 1000 / 60)
      const downward = (after.unwrappedY - before.unwrappedY) * 60
      minimum = Math.min(minimum, downward); maximum = Math.max(maximum, downward)
      assert.ok(downward > 0, `updraft at ${index}/${time}`)
      assert.ok(Math.abs(wrappedDelta(before.x, after.x, 394)) < 1, `sideways jump at ${index}/${time}`)
      assert.ok(Math.abs(wrappedDelta(before.y, after.y, 303)) < 1, `vertical jump at ${index}/${time}`)
      assert.ok(Math.abs(before.alpha - after.alpha) < .08, `opacity flash at ${index}/${time}`)
    }
  }
  assert.ok(minimum > 17 && maximum < 40, JSON.stringify({ minimum, maximum }))
  for (let index = 0; index < POETIC_SNOW_PARTICLES.length; index++) {
    const before = samplePoeticSnow(index, POETIC_SNOW_PERIOD_MS - 1), after = samplePoeticSnow(index, POETIC_SNOW_PERIOD_MS + 1)
    assert.ok(after.unwrappedY > before.unwrappedY)
    assert.ok(Math.abs(before.alpha - after.alpha) < .01)
  }
})

test('snow keeps moving inside one source frame and does not reset every character loop', () => {
  const a = samplePoeticSnow(9, 5), b = samplePoeticSnow(9, 35), c = samplePoeticSnow(9, 1285)
  assert.notEqual(a.y, b.y)
  assert.notEqual(a.y, c.y)
  for (const time of [-1, 0, 1280, 17329]) {
    const p = samplePoeticSnow(31, time), q = samplePoeticSnow(31, time + POETIC_SNOW_PERIOD_MS)
    for (const key of ['x', 'y', 'alpha']) assert.ok(Math.abs(p[key] - q[key]) < 1e-9)
  }
})

test('the expression remains clear while scenery receives a visibly stronger snow field', () => {
  assert.ok(poeticSnowFaceVisibility(179, 100) < .05)
  assert.ok(poeticSnowFaceVisibility(35, 95) > .98)
  assert.ok(poeticSnowFaceVisibility(179, 100) > 0)
  let faceEnergy = 0, scenicEnergy = 0
  for (let time = 0; time < POETIC_SNOW_PERIOD_MS; time += 601) {
    for (let index = 0; index < POETIC_SNOW_PARTICLES.length; index++) {
      const p = samplePoeticSnow(index, time)
      if (p.x < 0 || p.x > 358 || p.y < 0 || p.y > 267) continue
      const area = p.shape === 'crystal' ? 5 : p.shape === 'glint' ? 2 : 1
      const energy = p.alpha * area
      if (p.x > 125 && p.x < 233 && p.y > 75 && p.y < 150) faceEnergy += energy
      else scenicEnergy += energy
    }
  }
  assert.ok(faceEnergy / scenicEnergy < .035, JSON.stringify({ faceEnergy, scenicEnergy }))
})

test('sampling scales for high-resolution output, handles malformed seeks, and painting restores Canvas state', () => {
  for (const time of [NaN, Infinity, -Infinity, -1e10, 1e10]) {
    const value = samplePoeticSnow(3, time, NaN, -1)
    assert.ok(Object.values(value).every(item => typeof item !== 'number' || Number.isFinite(item)))
  }
  const a = samplePoeticSnow(70, 437), b = samplePoeticSnow(70, 437, 1432, 1068)
  assert.equal(b.x, a.x * 4); assert.equal(b.y, a.y * 4); assert.equal(b.size, a.size * 4)
  assert.equal(b.alpha, a.alpha)
  const calls = [], stack = []
  const context = {
    globalAlpha: .42, imageSmoothingEnabled: true, fillStyle: '#123456',
    save() { stack.push([this.globalAlpha, this.imageSmoothingEnabled, this.fillStyle]) },
    restore() { [this.globalAlpha, this.imageSmoothingEnabled, this.fillStyle] = stack.pop() },
    fillRect(...values) { calls.push({ values, alpha: this.globalAlpha }) },
  }
  createPoeticSnowPainter()(context, 0, 1432, 1068)
  assert.ok(calls.length > 150 && calls.length < POETIC_SNOW_PARTICLES.length * 5)
  assert.equal(context.globalAlpha, .42)
  assert.equal(context.imageSmoothingEnabled, true)
  assert.equal(context.fillStyle, '#123456')
  assert.equal(stack.length, 0)
  for (const { values: [x, y, width, height], alpha } of calls) {
    assert.ok([x, y, width, height].every(Number.isInteger))
    assert.equal(width, 4); assert.equal(height, 4)
    assert.ok(alpha >= 0 && alpha <= 1)
  }
})
