import { sampleBlink } from '../portrait/animation/portraitTimeline.ts'

export const CALM_PERIOD_MS = 12_000
export const CALM_MAX_ANGLE = .022

/** Small rigid rotations only: no scale, displacement field or face deformation. */
export const sampleCalmMotion = (elapsedMs: number) => {
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0
  const phase = ((elapsed % CALM_PERIOD_MS + CALM_PERIOD_MS) % CALM_PERIOD_MS) / CALM_PERIOD_MS * Math.PI * 2
  // Phase-delayed locks share one world wind. Subtract the rest offset so t=0
  // exactly matches the poster; derivatives remain continuous at every loop.
  const angle = (lag: number, amplitude: number) => amplitude *
    (Math.sin(phase - lag) - Math.sin(-lag) + .12 * (Math.sin(phase * 2 - lag) - Math.sin(-lag))) /
    (1.12 * (1 + Math.abs(Math.sin(lag))))
  return { left: angle(0, CALM_MAX_ANGLE), right: angle(.35, CALM_MAX_ANGLE * .86), eyeOpen: sampleBlink(elapsed) }
}
