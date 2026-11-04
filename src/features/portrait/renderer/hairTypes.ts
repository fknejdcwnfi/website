import type { MotionConfig } from '../animation/portraitTimeline'

export const HAIR_NODES = 16
export type HairSide = -1 | 1
export type HairBounds = { x0: number; y0: number; x1: number; y1: number }

/** One complete canonical cutout, in actual logical-canvas pixel coordinates. */
export type HairMaterial = {
  id: string
  z: number
  side: HairSide
  pixels: Uint32Array
  bounds: HairBounds
  /** Packed x/y pairs; exactly HAIR_NODES stations, sampled by arc length. */
  spine: Float32Array
  /** Per-lock physical differences; no parameter controls the face or blink. */
  motion: { mass: number; drag: number; bend: number; wind: number }
}

/** Retained canonical cast-shadow pixels follow their hair, clipped to the body. */
export type HairShadow = { id: string; lock: number; material: HairMaterial }

export type PortraitMaterials = {
  size: number
  canonical: Uint32Array
  closed: Uint32Array
  /** Static head/face/body, with all movable locks actually removed. */
  clean: Uint32Array
  /** Original local underpaint, retained for the independently cut jewelry. */
  repair: Uint32Array
  locks: HairMaterial[]
  /** Original visible central face and fixed body, excluding genuine hair occlusion. */
  faceMask: Uint8Array
  /** Material provenance / QA information; never a destination deformation field. */
  ownership: Int16Array
  bodyMask: Uint8Array
  shadows: HairShadow[]
}

export type HairPhysicsConfig = MotionConfig
export type HairPhysicsDiagnostics = {
  stepsPerSecond: number
  cacheHz: number
  warmupCycles: number
  maxLengthError: number
  maxSeamDistance: number
  maxDisplacement: number
  retainedBytes: number
}

/** New mesh and physics share world-space nodes, not an image-coordinate field. */
export type HairPoses = Float32Array[]
