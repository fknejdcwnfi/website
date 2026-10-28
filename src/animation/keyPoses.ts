/**
 * The ten key poses, transcribed from docs/reference/10_frame_prompts.md.
 *
 * `wind` and `eyeOpen` are dimensionless art-direction values:
 *   - wind:     0 = still, 1 = strongest gust
 *   - eyeOpen:  1 = fully open, 0 = fully closed
 *
 * Times are in milliseconds inside a 2300 ms loop. Frame 10 is byte-identical
 * to frame 1, which makes the wrap invisible.
 */
export type KeyPose = {
  /** 1-based pose number, used for labels and the ?pose= debug switch. */
  index: number
  timeMs: number
  wind: number
  eyeOpen: number
  /** Base-aware URL of the web-optimized frame. */
  src: string
  /** Short human label for the debug HUD. */
  label: string
}

export const FRAME_COUNT = 10
export const LOOP_MS = 2300

const frameSrc = (index: number): string =>
  `${import.meta.env.BASE_URL}assets/frames/frame_${String(index).padStart(2, '0')}.webp`

export const KEY_POSES: readonly KeyPose[] = [
  { index: 1, timeMs: 0, wind: 0.0, eyeOpen: 1.0, src: frameSrc(1), label: 'still' },
  { index: 2, timeMs: 230, wind: 0.18, eyeOpen: 1.0, src: frameSrc(2), label: 'first breeze' },
  { index: 3, timeMs: 460, wind: 0.45, eyeOpen: 1.0, src: frameSrc(3), label: 'breeze grows' },
  { index: 4, timeMs: 630, wind: 0.65, eyeOpen: 0.45, src: frameSrc(4), label: 'half blink' },
  { index: 5, timeMs: 740, wind: 0.7, eyeOpen: 0.0, src: frameSrc(5), label: 'eyes closed' },
  { index: 6, timeMs: 850, wind: 0.75, eyeOpen: 1.0, src: frameSrc(6), label: 'eyes reopen' },
  { index: 7, timeMs: 1020, wind: 0.9, eyeOpen: 1.0, src: frameSrc(7), label: 'peak gust' },
  { index: 8, timeMs: 1300, wind: 0.5, eyeOpen: 1.0, src: frameSrc(8), label: 'wind shifts' },
  { index: 9, timeMs: 1570, wind: 0.2, eyeOpen: 1.0, src: frameSrc(9), label: 'wind subsides' },
  { index: 10, timeMs: 1890, wind: 0.0, eyeOpen: 1.0, src: frameSrc(10), label: 'settled' },
] as const