/** Inspect up to two minutes without tying seeks to either animation period. */
export const MAX_SEEK_MS = 120_000

export type Theme = 'midnight' | 'emerald' | 'amethyst'

const bounded = (raw: string | null, fallback: number, low: number, high: number): number => {
  if (raw === null || raw.trim() === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback
}

/** Public customization stays in the URL; invalid input never reaches the renderer. */
export const readStageOptions = (search: string) => {
  const params = new URLSearchParams(search)
  const pose = Number(params.get('pose'))
  const theme = params.get('theme')
  const requestedTime = params.get('t')
  return {
    style: params.get('style') === 'legacy' ? 'legacy' as const
      : params.get('style') === 'voxel' ? 'voxel' as const : 'portrait' as const,
    debug: params.get('debug') === '1',
    frozenPose: Number.isInteger(pose) && pose >= 1 && pose <= 10 ? pose : null,
    wind: bounded(params.get('wind'), 1, 0, 1),
    speed: bounded(params.get('speed'), 1, 0.25, 2),
    seed: Math.floor(bounded(params.get('seed'), 7, 0, 0xffffffff)),
    theme: (theme === 'emerald' || theme === 'amethyst' ? theme : 'midnight') as Theme,
    direction: bounded(params.get('direction'), 1, -1, 1),
    gust: bounded(params.get('gust'), 0.35, 0.1, 2),
    stiffness: bounded(params.get('stiffness'), 18, 5, 40),
    damping: bounded(params.get('damping'), 5, 1, 12),
    pixel: [192, 256, 320].includes(Number(params.get('pixel'))) ? Number(params.get('pixel')) : 256,
    paused: params.get('pause') === '1',
    timeMs: requestedTime !== null && requestedTime.trim() !== '' && Number.isFinite(Number(requestedTime))
      ? bounded(requestedTime, 0, 0, MAX_SEEK_MS) : null,
  }
}

export type StageOptions = ReturnType<typeof readStageOptions>
