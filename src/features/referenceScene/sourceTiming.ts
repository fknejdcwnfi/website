/** A cyclic source clock; source image order and duration are its only inputs. */
export type SourceTiming = Readonly<{
  frameCount: number
  durationsMs: readonly number[]
  startsMs: readonly number[]
  durationMs: number
  sourceAnchorCount: number
  framesPerAnchor: number
}>

export type SourceTimeSample = {
  /** Rendered frame index (16 source frames or the separately authored interframes). */
  index: number
  nextIndex: number
  timeMs: number
  localMs: number
  frameDurationMs: number
  /** Fraction through the current rendered frame; this does not blend its pixels. */
  phase: number
  loopPhase: number
  sourceIndex: number
  nextSourceIndex: number
  sourceLocalMs: number
  sourcePhase: number
  isSourceAnchor: boolean
  /** Numbers beyond safe integer magnitude cannot retain every millisecond. */
  precisionLimited: boolean
}

/**
 * Build an immutable clock. The optional anchor count describes equal groups of
 * derived frames (128 samples / 16 anchors = 8 samples per original frame).
 * It never invents source frames or adds another wind/blink period.
 */
export const compileSourceTiming = (
  frameDurationsMs: readonly number[],
  declaredDurationMs?: number,
  sourceAnchorCount?: number,
): SourceTiming => {
  if (!Array.isArray(frameDurationsMs) || frameDurationsMs.length < 1 || frameDurationsMs.length > 4096) {
    throw new Error('Invalid source frame duration inventory.')
  }
  const frameCount = frameDurationsMs.length
  const anchors = sourceAnchorCount ?? frameCount
  if (!Number.isInteger(anchors) || anchors < 1 || anchors > frameCount || frameCount % anchors !== 0) {
    throw new Error('Invalid source anchor count.')
  }
  const durations: number[] = [], starts: number[] = []
  let duration = 0
  for (const value of frameDurationsMs) {
    if (!Number.isFinite(value) || value < .001 || value > 60_000) throw new Error('Invalid source frame duration.')
    starts.push(duration)
    durations.push(value)
    duration += value
  }
  if (!Number.isFinite(duration) || duration > 86_400_000) throw new Error('Invalid source loop duration.')
  if (declaredDurationMs !== undefined && (!Number.isFinite(declaredDurationMs) || declaredDurationMs <= 0 ||
    Math.abs(declaredDurationMs - duration) > Math.max(1, duration) * 1e-9)) {
    throw new Error('Source loop duration does not equal its frame durations.')
  }
  return Object.freeze({
    frameCount, durationsMs: Object.freeze(durations), startsMs: Object.freeze(starts),
    durationMs: duration, sourceAnchorCount: anchors, framesPerAnchor: frameCount / anchors,
  })
}

/** Read the exported atlas manifest or the original GIF project's timing JSON. */
export const validateSourceTiming = (metadata: unknown): SourceTiming => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Invalid source timing metadata.')
  const data = metadata as Record<string, unknown>
  const durations = data.frameDurationsMs ?? data.frame_durations_ms
  const count = data.frameCount ?? data.frame_count
  const duration = data.durationMs
  const anchors = data.sourceAnchorCount
  if (!Array.isArray(durations) || !Number.isInteger(count) || count !== durations.length ||
    durations.some(value => typeof value !== 'number') ||
    (duration !== undefined && typeof duration !== 'number') ||
    (anchors !== undefined && typeof anchors !== 'number')) throw new Error('Invalid source timing metadata.')
  // Exported timing uses camelCase; original source metadata uses snake_case.
  // Mixed disagreeing aliases are ambiguous and must not silently select one.
  if (data.frameCount !== undefined && data.frame_count !== undefined && data.frameCount !== data.frame_count) {
    throw new Error('Conflicting source frame counts.')
  }
  if (data.frameDurationsMs !== undefined && data.frame_durations_ms !== undefined &&
    JSON.stringify(data.frameDurationsMs) !== JSON.stringify(data.frame_durations_ms)) {
    throw new Error('Conflicting source frame durations.')
  }
  if (data.loop !== undefined && (!Number.isInteger(data.loop) || (data.loop as number) < 0 || (data.loop as number) > 65535)) {
    throw new Error('Invalid GIF loop count.')
  }
  return compileSourceTiming(durations as number[], duration as number | undefined, anchors as number | undefined)
}

/**
 * A modulo of the represented Number retains large-time precision better than
 * adding the period before taking a second modulo. It cannot recover precision
 * already absent from an unsafe-magnitude input; that limitation is reported.
 */
export const sampleSourceTime = (elapsedMs: number, timing: SourceTiming): SourceTimeSample => {
  const safeTime = Number.isFinite(elapsedMs) ? elapsedMs : 0
  const remainder = safeTime % timing.durationMs
  const wrapped = remainder < 0 ? remainder + timing.durationMs : remainder
  // A sub-ULP negative offset can round up to the period after addition.
  const timeMs = wrapped >= timing.durationMs || wrapped === 0 ? 0 : wrapped
  // Find the last start <= time. Exact boundaries select the new frame.
  let low = 0, high = timing.frameCount
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (timing.startsMs[middle]! <= timeMs) low = middle
    else high = middle
  }
  const index = low, localMs = timeMs - timing.startsMs[index]!
  const frameDurationMs = timing.durationsMs[index]!
  const sourceIndex = Math.floor(index / timing.framesPerAnchor)
  const firstSourceFrame = sourceIndex * timing.framesPerAnchor
  const sourceStart = timing.startsMs[firstSourceFrame]!
  const nextSourceFrame = firstSourceFrame + timing.framesPerAnchor
  const sourceEnd = nextSourceFrame === timing.frameCount ? timing.durationMs : timing.startsMs[nextSourceFrame]!
  const sourceLocalMs = timeMs - sourceStart
  return {
    index, nextIndex: (index + 1) % timing.frameCount, timeMs, localMs, frameDurationMs,
    phase: localMs / frameDurationMs, loopPhase: timeMs / timing.durationMs,
    sourceIndex, nextSourceIndex: (sourceIndex + 1) % timing.sourceAnchorCount,
    sourceLocalMs, sourcePhase: sourceLocalMs / (sourceEnd - sourceStart),
    isSourceAnchor: sourceLocalMs === 0,
    precisionLimited: !Number.isFinite(elapsedMs) || Math.abs(elapsedMs) > Number.MAX_SAFE_INTEGER,
  }
}
