/** High-definition output; source atlases retain their native 358×267 raster. */
export const SCENE_WIDTH = 716
export const SCENE_HEIGHT = 534

export type SceneImageSource = { src: string; width: number; height: number }

/** Authored imagery and provenance belong to this reference, never the archived portrait. */
export type SceneDefinition = {
  version: 1
  width: number
  height: number
  canonical: SceneImageSource
  layers?: Readonly<Record<string, SceneImageSource>>
  description: string
  motionSource: 'reconstructed' | 'source-timing'
}

export type SceneAssets = {
  definition: SceneDefinition
  canonical: HTMLImageElement
  layers: Readonly<Record<string, HTMLImageElement>>
}

export type SceneSample = {
  elapsedMs: number
  /** Static preference means the canonical frame, without local deformation. */
  static: boolean
}

/** The renderer owns frame pixels; the shared player owns time and visibility. */
export type SceneRenderer = {
  paint: (context: CanvasRenderingContext2D, sample: SceneSample) => void
  destroy?: () => void
}
export type SceneRendererFactory = (assets: SceneAssets, signal: AbortSignal) => SceneRenderer | Promise<SceneRenderer>

export type ScenePlayback = 'loading' | 'preparing' | 'looping' | 'static' | 'suspended' | 'failed' | 'stopped'
export type ScenePlayerState = { playback: ScenePlayback; painted: boolean; reduced: boolean }
export type ScenePlayerOptions = {
  motionEnabled?: boolean
  /** Read once when the first visible dynamic frame replaces a progressive preview. */
  initialElapsedMs?: () => number
  /** Explicit QA seeks retain a single stable frame without scheduling rAF. */
  timeMs?: number | null
  onState?: (state: ScenePlayerState) => void
}
