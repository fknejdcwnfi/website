import assert from 'node:assert/strict'
import test from 'node:test'
import { SNOW_PARTICLES, SNOW_LAYER_COUNTS, SNOW_PERIOD_MS, sampleSnowParticle, snowFaceVisibility, createSnowPainter } from '../../src/features/referenceScene/weather/snowField.ts'

const periodicDelta = (before, after, period) => {
  const delta = after - before
  return delta > period / 2 ? delta - period : delta < -period / 2 ? delta + period : delta
}

test('snow has three distributed depth layers present on the initial paint', () => {
  assert.deepEqual(SNOW_LAYER_COUNTS, { far: 96, middle: 80, near: 40 })
  assert.equal(SNOW_PARTICLES.length, 216)
  const counts = { far: 0, middle: 0, near: 0 }
  for (let i = 0; i < SNOW_PARTICLES.length; i++) {
    const sample = sampleSnowParticle(i, 0)
    if (sample.x >= 0 && sample.x < 358 && sample.y >= 0 && sample.y < 267) counts[sample.depth]++
  }
  assert.ok(counts.far >= 70 && counts.middle >= 60 && counts.near >= 28, counts)
  assert.equal(Object.isFrozen(SNOW_PARTICLES), true)
})

test('all visible snow falls downward and has bounded frame-to-frame drift', () => {
  let minVelocity = Infinity, maxVelocity = 0
  for (let t = 0; t < SNOW_PERIOD_MS; t += 197) {
    for (let i = 0; i < SNOW_PARTICLES.length; i++) {
      const before = sampleSnowParticle(i, t), after = sampleSnowParticle(i, t + 1000 / 120)
      const dy = periodicDelta(before.y, after.y, 299)
      const dx = periodicDelta(before.x, after.x, 390)
      const velocity = dy * 120
      minVelocity = Math.min(minVelocity, velocity); maxVelocity = Math.max(maxVelocity, velocity)
      assert.ok(dy > 0, `updraft at ${i}/${t}: ${dy}`)
      assert.ok(Math.abs(dx) < .5 && dy < .5, `jump at ${i}/${t}: ${dx},${dy}`)
      assert.ok(Math.abs(after.alpha - before.alpha) < .04, `opacity flash at ${i}/${t}`)
    }
  }
  assert.ok(minVelocity > 8 && maxVelocity < 40, { minVelocity, maxVelocity })
})

test('long weather cycle wraps independently from the short source GIF without a visible jump', () => {
  for (let i = 0; i < SNOW_PARTICLES.length; i++) {
    for (const time of [0, 1, 79.5, 1280, 7799.25, SNOW_PERIOD_MS - .001]) {
      const a = sampleSnowParticle(i, time), b = sampleSnowParticle(i, time + SNOW_PERIOD_MS)
      for (const key of ['x', 'y', 'alpha']) assert.ok(Math.abs(a[key] - b[key]) < 1e-10, `${i}/${time}/${key}`)
    }
    const end = sampleSnowParticle(i, SNOW_PERIOD_MS - 1000 / 120), start = sampleSnowParticle(i, 0)
    assert.ok(periodicDelta(end.y, start.y, 299) > 0)
    assert.ok(Math.abs(periodicDelta(end.x, start.x, 390)) < .5)
  }
  const a = sampleSnowParticle(0, 0), b = sampleSnowParticle(0, 1280)
  assert.notEqual(a.y, b.y)
})

test('face and eyes remain readable while the scenic sides retain the stronger snow field', () => {
  assert.ok(snowFaceVisibility(179, 98) <= .13)
  assert.ok(snowFaceVisibility(35, 95) > .99)
  let faceArea = 0, scenicArea = 0
  for (let t = 0; t < SNOW_PERIOD_MS; t += 400) {
    for (let i = 0; i < SNOW_PARTICLES.length; i++) {
      const sample = sampleSnowParticle(i, t)
      if (sample.x < 0 || sample.x > 358 || sample.y < 0 || sample.y > 267) continue
      const area = sample.alpha * sample.size ** 2
      if (sample.x > 125 && sample.x < 232 && sample.y > 75 && sample.y < 135) faceArea += area
      else scenicArea += area
    }
  }
  assert.ok(faceArea / scenicArea < .035, { faceArea, scenicArea })
})

test('snow sampling remains finite at malformed seeks and scales positions without changing the scene layout', () => {
  for (const value of [NaN, Infinity, -Infinity, -1e10, 1e10]) {
    const sample = sampleSnowParticle(3, value, NaN, -1)
    assert.ok(Object.values(sample).every(value => typeof value !== 'number' || Number.isFinite(value)))
  }
  const a = sampleSnowParticle(70, 437), b = sampleSnowParticle(70, 437, 716, 534)
  assert.equal(b.x, a.x * 2); assert.equal(b.y, a.y * 2); assert.equal(b.size, a.size * 2)
  assert.equal(b.alpha, a.alpha)
})

test('snow painter restores context and uses crisp bounded pixel rectangles without frame allocation', () => {
  const calls = [], context = {
    save() { calls.push(['save']) }, restore() { calls.push(['restore']) },
    fillRect(...values) { calls.push(['rect', ...values]) },
  }
  const paint = createSnowPainter()
  paint(context, 0)
  assert.equal(calls[0][0], 'save'); assert.equal(calls.at(-1)[0], 'restore')
  assert.equal(context.imageSmoothingEnabled, false)
  const rectangles = calls.filter(call => call[0] === 'rect')
  assert.ok(rectangles.length >= 160 && rectangles.length <= 216)
  for (const [, x, y, width, height] of rectangles) {
    assert.ok(Number.isInteger(x) && Number.isInteger(y))
    assert.ok(width === height && [1, 3].includes(width))
  }
})
