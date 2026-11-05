/** Native source raster. Display clipping must never resample the authored frames. */
export const SCENE_WIDTH = 358
export const SCENE_HEIGHT = 267

export type SceneImageSource = { src: string; width: number; height: number }

/** Authored imagery and provenance belong to this reference, never the archived portrait. */
export type SceneDefinition = {
  version: 1
  width: typeof SCENE_WIDTH
  height: typeof SCENE_HEIGHT
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

/** The renderer owns local hair, eye and jewelry movement; the player owns time. */
export type SceneRenderer = {
  paint: (context: CanvasRenderingContext2D, sample: SceneSample) => void
  destroy?: () => void
}
export type SceneRendererFactory = (assets: SceneAssets, signal: AbortSignal) => SceneRenderer | Promise<SceneRenderer>

export type ScenePlayback = 'loading' | 'preparing' | 'looping' | 'static' | 'suspended' | 'failed' | 'stopped'
export type ScenePlayerState = { playback: ScenePlayback; painted: boolean; reduced: boolean }
export type ScenePlayerOptions = {
  motionEnabled?: boolean
  /** Explicit QA seeks retain a single stable frame without scheduling rAF. */
  timeMs?: number | null
  onState?: (state: ScenePlayerState) => void
}
