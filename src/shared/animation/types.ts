/** Shared timestamp/pose data; no renderer or DOM dependency. */
export type TimelineSample = {
  /** Loop-local time in milliseconds. */
  timeMs: number
  /** 1-based index of the pose being held. */
  poseIndex: number
  /** 1-based index of the pose being blended into. */
  nextIndex: number
  /** Cross-fade weight of the next pose, 0..1. */
  blend: number
  wind: number
  eyeOpen: number
}
