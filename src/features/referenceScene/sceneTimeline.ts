import type { SceneSample } from './types'

/** The source renderer alone owns GIF timing, including hair, eyes and ornaments. */
export const sampleScene = (elapsedMs: number, canonical = false): SceneSample => ({
  elapsedMs: canonical || !Number.isFinite(elapsedMs) ? 0 : elapsedMs,
  static: canonical,
})
