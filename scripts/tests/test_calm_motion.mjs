import test from 'node:test'
import assert from 'node:assert/strict'
import { sampleCalmMotion, CALM_MAX_ANGLE, CALM_PERIOD_MS } from '../../src/features/calmPortrait/motion.ts'

test('calm hair starts at the canonical pose and remains periodic with continuous velocity', () => {
  assert.equal(sampleCalmMotion(0).left, 0)
  assert.equal(sampleCalmMotion(0).right, 0)
  for (const key of ['left', 'right']) {
    for (const t of [-100, 0, 2731, 9999, 12000]) {
      assert.ok(Math.abs(sampleCalmMotion(t)[key] - sampleCalmMotion(t + CALM_PERIOD_MS)[key]) < 1e-12)
    }
    const velocityBefore = (sampleCalmMotion(0)[key] - sampleCalmMotion(-1)[key])
    const velocityAfter = (sampleCalmMotion(1)[key] - sampleCalmMotion(0)[key])
    assert.ok(Math.abs(velocityBefore - velocityAfter) < 1e-7)
  }
  assert.notEqual(sampleCalmMotion(1280).left, sampleCalmMotion(0).left)
})

test('rigid hair matrices keep their root, length and area without stretching', () => {
  for (let t = 0; t <= 24000; t += 73) {
    const motion = sampleCalmMotion(t)
    for (const angle of [motion.left, motion.right]) {
      assert.ok(Math.abs(angle) <= CALM_MAX_ANGLE + 1e-12)
      const c = Math.cos(angle), s = Math.sin(angle)
      assert.ok(Math.abs(c*c+s*s-1) < 1e-12)
      const dx = 17, dy = 90, x = c*dx-s*dy, y = s*dx+c*dy
      assert.ok(Math.abs(Math.hypot(x,y)-Math.hypot(dx,dy)) < 1e-10)
      assert.ok(Math.hypot(x-dx,y-dy) < 2.1)
    }
  }
})

test('only local eyelids blink on the independent accepted schedule', () => {
  assert.equal(sampleCalmMotion(0).eyeOpen, 1)
  for (const closed of [4500, 11400, 20400]) assert.equal(sampleCalmMotion(closed).eyeOpen, 0)
  assert.equal(sampleCalmMotion(7000).eyeOpen, 1)
  for (const t of [NaN, Infinity, -Infinity]) {
    const m = sampleCalmMotion(t)
    assert.ok(Object.values(m).every(Number.isFinite))
    assert.equal(m.eyeOpen, 1)
  }
})
