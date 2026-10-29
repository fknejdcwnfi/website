import type { TimelineSample } from './timeline'

export const LOOP_MS = 2300
export const KEY_TIMES = [0, 230, 460, 630, 740, 850, 1020, 1300, 1570, 1890] as const
export const BLINK_START = 630
export const BLINK_CLOSED = 740
export const BLINK_END = 850

const WIND_KEYS = [0, 0.18, 0.45, 0.65, 0.70, 0.75, 0.90, 0.50, 0.20, 0] as const
const smoothstep = (value: number): number => {
  const x = Math.max(0, Math.min(1, value))
  return x * x * (3 - 2 * x)
}
const bounded = (value: number, fallback: number, low: number, high: number): number =>
  Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback

const loopTime = (elapsed: number): number =>
  Number.isFinite(elapsed) ? ((elapsed % LOOP_MS) + LOOP_MS) % LOOP_MS : 0

/** The reference images provide wind intent, never independent face images. */
const referenceWind = (timeMs: number): number => {
  if (timeMs <= 0 || timeMs >= KEY_TIMES[9]) return 0
  for (let index = 0; index < KEY_TIMES.length - 1; index += 1) {
    const start = KEY_TIMES[index]!
    const end = KEY_TIMES[index + 1]!
    if (timeMs < end) {
      const mix = smoothstep((timeMs - start) / (end - start))
      return WIND_KEYS[index]! + (WIND_KEYS[index + 1]! - WIND_KEYS[index]!) * mix
    }
  }
  return 0
}

/** One 220ms eye event on the same face, independent of the wind solver. */
export const samplePortrait = (
  elapsed: number,
  windGain: number,
  frozenPose: number | null = null,
): TimelineSample => {
  const pose = frozenPose !== null && Number.isInteger(frozenPose) && frozenPose >= 1 && frozenPose <= 10
    ? frozenPose
    : null
  const timeMs = pose === null ? loopTime(elapsed) : pose === 10 ? 0 : KEY_TIMES[pose - 1]!
  const gain = bounded(windGain, 0.65, 0, 1)
  let position = 0
  for (let index = 1; index < KEY_TIMES.length; index += 1) {
    if (timeMs >= KEY_TIMES[index]!) position = index
  }
  const end = KEY_TIMES[position + 1] ?? LOOP_MS
  const blend = position === 9 ? 0 : smoothstep((timeMs - KEY_TIMES[position]!) / (end - KEY_TIMES[position]!))
  let eyeOpen = 1
  if (timeMs >= BLINK_START && timeMs < BLINK_CLOSED) {
    eyeOpen = 1 - smoothstep((timeMs - BLINK_START) / (BLINK_CLOSED - BLINK_START))
  } else if (timeMs >= BLINK_CLOSED && timeMs < BLINK_END) {
    eyeOpen = smoothstep((timeMs - BLINK_CLOSED) / (BLINK_END - BLINK_CLOSED))
  }
  // Frozen poses are deliberate art/QA overrides, not a second blink clock.
  if (pose === 4) eyeOpen = 0.45
  if (pose === 5) eyeOpen = 0
  return {
    timeMs,
    poseIndex: pose ?? position + 1,
    nextIndex: pose ?? (position === 9 ? 1 : position + 2),
    blend: pose === null ? blend : 0,
    wind: referenceWind(timeMs) * gain,
    eyeOpen,
  }
}

export type MotionConfig = {
  /** -1..1: negative reverses the breeze; zero disables hair and ear motion. */
  direction: number
  /** Smooth gust frequency in Hz, 0.1..2. */
  gust: number
  /** Art-direction stiffness, 5..40; default18 maps to a physical k of180. */
  stiffness: number
  /** Art-direction damping, 1..12; default5 maps to a physical c of15. */
  damping: number
}

export const HAIR_CHANNELS = 8
export const MOTION_CHANNELS = 10
const DELAYS = [0, 24, 12, 12, 51, 67, 82, 105, 128, 153] as const
const AMPLITUDES = [0.72, 0.90, 1, 0.56, 0.66, 0.75, 0.96, 1, 0.48, 0.43] as const
const STIFFNESS = [1.18, 1.05, 0.96, 1.12, 0.92, 0.82, 0.74, 0.69, 0.56, 0.51] as const
const DAMPING = [1.12, 1.07, 1.01, 1.06, 1.02, 1.10, 0.91, 0.96, 1.15, 1.22] as const

/**
 * Eight wind-driven locks and two independently delayed earring pendulums.
 * The 1ms offline solve is independent of display refresh rate and random seek.
 * Rendering applies each group's root weights and the user's wind gain later.
 */
export const createMotionTable = (config: MotionConfig): Float32Array[] => {
  const direction = bounded(config.direction, 1, -1, 1)
  const frequency = bounded(config.gust, 0.35, 0.1, 2)
  const stiffness = bounded(config.stiffness, 18, 5, 40) * 10
  const damping = bounded(config.damping, 5, 1, 12) * 3
  return DELAYS.map((delay, group) => {
    const channel = new Float32Array(LOOP_MS + 1)
    const k = stiffness * STIFFNESS[group]!
    const c = damping * DAMPING[group]!
    let position = 0
    let velocity = 0
    for (let timeMs = 1; timeMs <= LOOP_MS; timeMs += 1) {
      const delayed = timeMs - delay
      const t = Math.max(0, delayed) / 1000
      const phase = group * 0.41
      const gust = 1 + 0.13 * Math.sin(Math.PI * 2 * frequency * t + phase)
        + 0.05 * Math.sin(Math.PI * 2 * frequency * 2.3 * t - phase)
      const breeze = referenceWind(delayed)
      // The reference's frame08 is a change of wind direction: a restrained
      // backdraft produces an actual return swing, rather than a static fade.
      const backdraft = smoothstep((delayed - 1080) / 200)
        * (1 - smoothstep((delayed - 1500) / 220))
      const ripple = 0.065 * Math.sin(t * Math.PI * 2 * (1.25 + frequency) - phase)
      const target = (breeze * (gust + ripple) - backdraft * 0.62) * direction
      velocity += (k * (target - position) - c * velocity) * 0.001
      position += velocity * 0.001
      // A zero-slope settling envelope prevents a reset at the loop boundary.
      const settle = 1 - smoothstep((timeMs - KEY_TIMES[8]) / (KEY_TIMES[9] - KEY_TIMES[8]))
      // A small immediate drag lets frame02 catch the first breeze; inertia
      // remains dominant, and pendulums are driven only by the spring solve.
      const response = group < HAIR_CHANNELS ? position * 0.84 + target * 0.16 : position
      channel[timeMs] = settle === 0 ? 0 : response * AMPLITUDES[group]! * settle
    }
    return channel
  })
}

/** Linear lookup preserves continuous motion between the precomputed 1ms samples. */
export const sampleMotion = (table: readonly Float32Array[], timeMs: number, group: number): number => {
  if (!Number.isInteger(group) || group < 0 || group >= table.length) return 0
  const channel = table[group]
  if (!channel || channel.length < LOOP_MS + 1) return 0
  const time = loopTime(timeMs)
  const start = Math.floor(time)
  const mix = time - start
  return channel[start]! + (channel[start + 1]! - channel[start]!) * mix
}
