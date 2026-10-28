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
  return {
    style: params.get('style') === 'legacy' ? 'legacy' as const : 'voxel' as const,
    debug: params.get('debug') === '1',
    frozenPose: Number.isInteger(pose) && pose >= 1 && pose <= 10 ? pose : null,
    wind: bounded(params.get('wind'), 0.65, 0, 1),
    speed: bounded(params.get('speed'), 1, 0.25, 2),
    seed: Math.floor(bounded(params.get('seed'), 7, 0, 0xffffffff)),
    theme: (theme === 'emerald' || theme === 'amethyst' ? theme : 'midnight') as Theme,
  }
}

export type StageOptions = ReturnType<typeof readStageOptions>
