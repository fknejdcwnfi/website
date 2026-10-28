import type { TimelineSample } from './timeline'

export const LOOP_MS = 4800
export const BLINK_START = 2190
export const BLINK_END = 2410

/** Four eyelid poses on one fixed face; the 220ms blink closes then opens. */
export const sampleVoxel = (
  elapsed: number,
  wind: number,
  frozenPose: number | null = null,
): TimelineSample => {
  const timeMs = frozenPose === null
    ? ((elapsed % LOOP_MS) + LOOP_MS) % LOOP_MS
    : frozenPose === 10 ? 0 : (frozenPose - 1) * LOOP_MS / 10
  const blink = timeMs >= BLINK_START && timeMs < BLINK_END
    ? timeMs < 2280 ? (timeMs - BLINK_START) / 90 : (BLINK_END - timeMs) / 130
    : 0
  const eyeOpen = frozenPose === 5 ? 0 : frozenPose === 4 ? 0.45 : 1 - blink
  const index = frozenPose ?? Math.min(10, Math.floor(timeMs / (LOOP_MS / 10)) + 1)
  return { timeMs, poseIndex: index, nextIndex: index, blend: 0, wind, eyeOpen }
}
