import type { KeyPose } from './keyPoses'

/**
 * A sampled point on the key-pose timeline.
 *
 * This module is deliberately free of DOM and Vite APIs so the sampling rules
 * can be reasoned about (and later unit-tested) independently of Canvas.
 */
import type { TimelineSample } from '../../shared/animation/types'
export type { TimelineSample } from '../../shared/animation/types'

const MAX_FADE_MS = 140

const smoothstep = (value: number): number =>
  value <= 0 ? 0 : value >= 1 ? 1 : value * value * (3 - 2 * value)

/**
 * Sample the timeline at `timeMs`.
 *
 * The pose holds for most of its slot, then cross-fades into the next pose
 * during the final `min(MAX_FADE_MS, segment * 0.55)` milliseconds.
 */
export const sampleTimeline = (
  poses: readonly KeyPose[],
  timeMs: number,
  loopMs: number,
  maxFadeMs = MAX_FADE_MS,
): TimelineSample => {
  if (poses.length === 0) {
    throw new Error('sampleTimeline requires at least one key pose')
  }

  const first = poses[0]!
  let position = 0
  for (let index = 0; index < poses.length; index += 1) {
    const pose = poses[index]
    if (pose && pose.timeMs <= timeMs) position = index
  }

  const current = poses[position] ?? first
  const isLast = position === poses.length - 1
  const next = isLast ? first : poses[position + 1]!
  const nextTime = isLast ? loopMs : next.timeMs
  const segment = Math.max(1, nextTime - current.timeMs)
  const fade = Math.min(maxFadeMs, segment * 0.55)
  const fadeStart = nextTime - fade
  const blend =
    fade > 0 && timeMs >= fadeStart
      ? smoothstep((timeMs - fadeStart) / fade)
      : 0

  return {
    timeMs,
    poseIndex: current.index,
    nextIndex: next.index,
    blend,
    wind: current.wind + (next.wind - current.wind) * blend,
    eyeOpen: current.eyeOpen + (next.eyeOpen - current.eyeOpen) * blend,
  }
}