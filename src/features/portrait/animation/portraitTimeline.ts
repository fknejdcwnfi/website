import type { TimelineSample } from '../../../shared/animation/types'

/** A slow breeze and an independent, longer blink schedule. */
export const LOOP_MS = 12_000
export const KEY_TIMES = [0, 1200, 2400, 3600, 4800, 6000, 7200, 8400, 9600, 10800] as const
export const BLINK_CYCLE_MS = 24_000
export const BLINK_STARTS = [4400, 11300, 20300] as const
export const BLINK_CLOSE_MS = 100
export const BLINK_HOLD_MS = 20
export const BLINK_OPEN_MS = 160
export const BLINK_DURATION_MS = BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS
export const BLINK_START = BLINK_STARTS[0]
export const BLINK_CLOSED = BLINK_START + BLINK_CLOSE_MS
export const BLINK_END = BLINK_START + BLINK_DURATION_MS

const TAU = Math.PI * 2
const bounded = (value: number, fallback: number, low: number, high: number): number =>
  Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback
const wrap = (elapsed: number, duration: number): number =>
  Number.isFinite(elapsed) ? ((elapsed % duration) + duration) % duration : 0

/** Zero velocity and acceleration at both ends; no eyelid snap at closure. */
const ease = (value: number): number => {
  const x = Math.max(0, Math.min(1, value))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** Local eye event reused by automatic and explicit developer-triggered blinks. */
export const sampleBlinkProgress = (elapsed: number): number => {
  if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed >= BLINK_DURATION_MS) return 1
  const openness = elapsed < BLINK_CLOSE_MS ? 1 - ease(elapsed / BLINK_CLOSE_MS)
    : elapsed < BLINK_CLOSE_MS + BLINK_HOLD_MS ? 0
      : ease((elapsed - BLINK_CLOSE_MS - BLINK_HOLD_MS) / BLINK_OPEN_MS)
  // rAF accumulation can land a few floating-point ulps either side of a lid
  // endpoint. Preserve its exact semantic state before the rasterizer branches.
  return openness <= 1e-12 ? 0 : openness >= 1 - 1e-12 ? 1 : openness
}

/** Unequal 6.9 / 9.0 / 8.1 second gaps keep blinking separate from the breeze. */
export const sampleBlink = (elapsed: number): number => {
  const time = wrap(elapsed, BLINK_CYCLE_MS)
  for (const start of BLINK_STARTS) {
    if (time >= start && time <= start + BLINK_DURATION_MS) return sampleBlinkProgress(time - start)
  }
  return 1
}

/** Reference poses are explicit inspection overrides, never a series of faces. */
export const samplePortrait = (
  elapsed: number,
  windGain: number,
  frozenPose: number | null = null,
): TimelineSample => {
  const pose = frozenPose !== null && Number.isInteger(frozenPose) && frozenPose >= 1 && frozenPose <= 10
    ? frozenPose : null
  const timeMs = pose === null ? wrap(elapsed, LOOP_MS) : pose === 10 ? 0 : KEY_TIMES[pose - 1]!
  const gain = bounded(windGain, 1, 0, 1)
  const position = Math.min(9, Math.floor(timeMs / 1200))
  const phase = TAU * timeMs / LOOP_MS
  return {
    timeMs,
    poseIndex: pose ?? position + 1,
    nextIndex: pose ?? (position === 9 ? 1 : position + 2),
    blend: pose === null ? ease((timeMs - KEY_TIMES[position]!) / 1200) : 0,
    wind: pose === 1 || pose === 10 ? 0 : gain * (0.5 + 0.12 * Math.sin(phase) + 0.05 * Math.sin(phase * 2 + 0.3)),
    // Use absolute elapsed time here: wrapping at the wind period would repeat
    // or erase blink events in the second half of the independent schedule.
    eyeOpen: pose === null ? sampleBlink(elapsed) : pose === 4 ? 0.45 : pose === 5 ? 0 : 1,
  }
}

export type MotionConfig = {
  /** -1..1: negative reverses the breeze; zero disables hair and ear motion. */
  direction: number
  /** 0.1..2: relative detail of the secondary wind harmonics. */
  gust: number
  /** Art-directed spring stiffness, 5..40. */
  stiffness: number
  /** Art-directed spring damping, 1..12. */
  damping: number
}

export const HAIR_CHANNELS = 8
export const MOTION_CHANNELS = 10
const DELAYS = [0, 100, 65, 160, 240, 310, 420, 540, 650, 810] as const
const AMPLITUDES = [0.72, 0.90, 1, 0.56, 0.66, 0.75, 0.96, 1, 0.48, 0.43] as const
const STIFFNESS = [1.18, 1.05, 0.96, 1.12, 0.92, 0.82, 0.74, 0.69, 0.56, 0.51] as const
const DAMPING = [1.12, 1.07, 1.01, 1.06, 1.02, 1.10, 0.91, 0.96, 1.15, 1.22] as const

/**
 * The steady-state spring response to three smooth wind harmonics. Solving in
 * frequency space removes the start-up transient, settling envelope and reset.
 * Every harmonic completes an integer number of turns, so value and every
 * derivative agree at the seam. Lookup samples are built once, outside rAF.
 */
export const createMotionTable = (config: MotionConfig): Float32Array[] => {
  const direction = bounded(config.direction, 1, -1, 1)
  const detail = bounded(config.gust, 0.35, 0.1, 2)
  const stiffness = bounded(config.stiffness, 18, 5, 40)
  const damping = bounded(config.damping, 5, 1, 12)
  const strengths = [0.19, 0.035 + detail * 0.022, 0.012 + detail * 0.008]
  return DELAYS.map((delay, group) => {
    const channel = new Float32Array(LOOP_MS + 1)
    const k = stiffness * STIFFNESS[group]!
    const c = damping * DAMPING[group]!
    const harmonics = strengths.map((strength, index) => {
      const order = index + 1
      const omega = TAU * order / (LOOP_MS / 1000)
      const response = Math.min(1.2, k / Math.hypot(k - omega * omega, c * omega))
      return {
        order,
        amplitude: strength * response,
        phase: group * 0.22 * (order - 1) - omega * delay / 1000 - Math.atan2(c * omega, k - omega * omega),
      }
    })
    for (let time = 0; time < LOOP_MS; time += 1) {
      const phase = TAU * time / LOOP_MS
      let value = 0
      for (const harmonic of harmonics) value += harmonic.amplitude * Math.sin(phase * harmonic.order + harmonic.phase)
      channel[time] = value * AMPLITUDES[group]! * direction
    }
    channel[LOOP_MS] = channel[0]!
    return channel
  })
}

/** Linear interpolation preserves fractional timing at every display refresh. */
export const sampleMotion = (table: readonly Float32Array[], timeMs: number, group: number): number => {
  if (!Number.isInteger(group) || group < 0 || group >= table.length) return 0
  const channel = table[group]
  if (!channel || channel.length < LOOP_MS + 1) return 0
  const time = wrap(timeMs, LOOP_MS)
  const start = Math.floor(time)
  const mix = time - start
  return channel[start]! + (channel[start + 1]! - channel[start]!) * mix
}
