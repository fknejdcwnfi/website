import { sampleMotion, type MotionConfig } from '../animation/portraitTimeline'
import { createHairMaterials } from './hairMaterials'
import { HairMesh } from './hairMesh'
import { prepareHairPhysics } from './hairPhysicsClient'
import { createJewelryMasks } from './portraitJewelry'
import type { HairPhysics } from './hairPhysics'
import { HAIR_NODES, type HairMaterial, type HairPoses, type PortraitMaterials } from './hairTypes'

export type Point = readonly [number, number]

/** Original local eyelid geometry: independent from the replacement hair rig. */
export const EYES: readonly { polygon: readonly Point[]; x0: number; x1: number; top0: number; top1: number; bottom: number }[] = [
  { polygon: [[64, 70], [70, 67], [88, 69], [104, 74], [104, 81], [93, 87], [77, 86], [65, 81]], x0: 64, x1: 104, top0: 67, top1: 74, bottom: 87 },
  { polygon: [[138, 74], [146, 68], [160, 64], [178, 61], [183, 64], [178, 75], [168, 81], [151, 83], [140, 80]], x0: 138, x1: 183, top0: 73, top1: 61, bottom: 83 },
]

export const inside = (x: number, y: number, points: readonly Point[]): boolean => {
  let result = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!, [xj, yj] = points[j]!
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result
  }
  return result
}

type EyePixel = { index: number; y: number; top: number; height: number }
type Jewelry = { mesh: HairMesh; pose: Float32Array; root: Point; channel: number }

/**
 * New cutout / skeletal-mesh compositor. Hair never samples the full portrait,
 * and moving material never reads face, body or neighboring locks as texture.
 */
export class PortraitRig {
  readonly materials: PortraitMaterials
  readonly size: number
  readonly poses: HairPoses
  readonly meshes: HairMesh[]
  readonly shadowMeshes: HairMesh[]
  readonly shadowPixels: Uint32Array
  readonly shadowDiagnostics = { candidatePixels: 0, clippedPixels: 0, compositedPixels: 0 }
  readonly jewelry: Jewelry[] = []
  physics: HairPhysics | null = null
  private readonly output: ImageData
  private readonly target: Uint32Array
  private readonly eyePixels: EyePixel[] = []
  private readonly drawOrder: number[]
  private preparation = 0
  private config: MotionConfig = { direction: 1, gust: 0.35, stiffness: 18, damping: 5 }

  constructor(materials: PortraitMaterials)
  constructor(open: CanvasImageSource, closed: CanvasImageSource, size: number, underpaint: CanvasImageSource, matteImage?: CanvasImageSource)
  constructor(input: PortraitMaterials | CanvasImageSource, closed?: CanvasImageSource, pixelSize?: number, underpaint?: CanvasImageSource, matteImage?: CanvasImageSource) {
    if ('canonical' in input && 'locks' in input) {
      // The decoded bundle may be shared between players. Only the plate is
      // edited locally when the independently moving jewelry is lifted out.
      this.materials = { ...input, clean: input.clean.slice() }
      this.size = input.size
    } else {
      if (!closed || pixelSize === undefined || !underpaint) throw new Error('Source portrait authoring requires open, closed and underpaint images plus a pixel size.')
      this.materials = createHairMaterials(input, closed, underpaint, pixelSize, matteImage)
      this.size = pixelSize
    }
    const size = this.size
    this.output = new ImageData(size, size)
    this.target = new Uint32Array(this.output.data.buffer)
    this.poses = this.materials.locks.map((lock) => new Float32Array(lock.spine))
    this.meshes = this.materials.locks.map((lock) => new HairMesh(lock, size))
    this.shadowMeshes = this.materials.shadows.map(({ lock, material }) => {
      if (!this.poses[lock]) throw new Error('A cast shadow must refer to an existing hair lock.')
      return new HairMesh(material, size)
    })
    this.shadowPixels = new Uint32Array(size * size)
    this.drawOrder = this.materials.locks.map((_, index) => index)
      .sort((a, b) => this.materials.locks[a]!.z - this.materials.locks[b]!.z)
    for (let i = 0; i < size * size; i += 1) {
      const x = (i % size + 0.5) * 256 / size, y = (Math.floor(i / size) + 0.5) * 256 / size
      for (const eye of EYES) {
        if (!inside(x, y, eye.polygon)) continue
        const u = (x - eye.x0) / (eye.x1 - eye.x0)
        const top = eye.top0 + (eye.top1 - eye.top0) * u
        const bottom = eye.bottom - Math.abs(u - 0.5) * 7
        this.eyePixels.push({ index: i, y, top, height: bottom - top })
      }
    }
    this.prepareJewelry()
  }

  /** Physics warmup is performed outside the main animation thread. */
  async prepare(config: MotionConfig): Promise<void> {
    const revision = ++this.preparation
    const snapshot = { ...config }
    const physics = await prepareHairPhysics(this.materials.locks, snapshot, this.size)
    if (revision !== this.preparation) return
    this.config = snapshot
    this.physics = physics
  }

  private prepareJewelry(): void {
    const { size, materials } = this
    const repair = materials.repair
    // Underpaint neighboring colors fill only the local jewelry footprint. The
    // original canonical array itself remains byte-identical for static modes.
    const source = materials.canonical
    for (const { id, side, root, channel, mask } of createJewelryMasks(source, size)) {
      const pixels = new Uint32Array(size * size)
      let x0 = size, y0 = size, x1 = 0, y1 = 0
      for (let index = 0; index < mask.length; index += 1) {
        if (!mask[index]) continue
        const x = index % size, y = Math.floor(index / size)
        pixels[index] = source[index]!
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
        let replacement = 0, distance = Infinity
        const reach = Math.ceil(9 * size / 256)
        for (let dy = -reach; dy <= reach; dy += 1) for (let dx = -reach; dx <= reach; dx += 1) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= size || ny < 0 || ny >= size || dx * dx + dy * dy >= distance) continue
          const candidate = ny * size + nx, color = repair[candidate]!
          if (mask[candidate] || color >>> 24 !== 255) continue
          replacement = color
          distance = dx * dx + dy * dy
        }
        materials.clean[index] = replacement
      }
      if (x0 === size) continue
      const spine = new Float32Array(HAIR_NODES * 2)
      const rx = root[0], ry = root[1]
      for (let node = 0; node < HAIR_NODES; node += 1) {
        spine[node * 2] = rx
        spine[node * 2 + 1] = ry + (y1 - ry + 1) * node / (HAIR_NODES - 1)
      }
      const material: HairMaterial = { id, side, z: 5, pixels, bounds: { x0, y0, x1, y1 }, spine,
        motion: { mass: 1, drag: 1, bend: 1, wind: 1 } }
      this.jewelry.push({ mesh: new HairMesh(material, size), pose: new Float32Array(spine), root: [rx, ry], channel })
    }
  }

  private eyelids(eyeOpen: number): void {
    if (eyeOpen >= 1) return
    for (const eye of this.eyePixels) {
      const lid = eye.top + eye.height * (1 - eyeOpen)
      if (eyeOpen <= 0 || eye.y < lid) this.target[eye.index] = this.materials.closed[eye.index]!
      if (eyeOpen > 0 && Math.abs(eye.y - lid) < 0.65) this.target[eye.index] = 0xff292324
    }
  }

  paint(ctx: CanvasRenderingContext2D, table: Float32Array[], timeMs: number, gain: number, eyeOpen: number): void {
    if (gain === 0 || this.config.direction === 0) {
      this.target.set(this.materials.canonical)
      this.eyelids(eyeOpen)
      ctx.putImageData(this.output, 0, 0)
      return
    }
    if (!this.physics) throw new Error('Layered hair physics must finish preparing before painting.')
    this.physics.sample(timeMs, gain, this.poses)
    this.target.fill(0)
    for (let lock = 0; lock < this.meshes.length; lock += 1) {
      this.meshes[lock]!.update(this.poses[lock]!)
    }
    for (const lock of this.drawOrder) if (this.materials.locks[lock]!.z < 0) this.meshes[lock]!.draw(this.target)
    const clean = this.materials.clean
    for (let i = 0; i < clean.length; i += 1) if (clean[i]! >>> 24 === 255) this.target[i] = clean[i]!
    this.shadowPixels.fill(0)
    for (let shadow = 0; shadow < this.shadowMeshes.length; shadow += 1) {
      const mesh = this.shadowMeshes[shadow]!, lock = this.materials.shadows[shadow]!.lock
      mesh.update(this.poses[lock]!)
      mesh.draw(this.shadowPixels)
    }
    let candidatePixels = 0, clippedPixels = 0
    for (let i = 0; i < this.shadowPixels.length; i += 1) {
      const color = this.shadowPixels[i]!
      if (color >>> 24 !== 255) continue
      candidatePixels += 1
      if (!this.materials.bodyMask[i]) { clippedPixels += 1; continue }
      this.target[i] = color
    }
    this.shadowDiagnostics.candidatePixels = candidatePixels
    this.shadowDiagnostics.clippedPixels = clippedPixels
    this.shadowDiagnostics.compositedPixels = candidatePixels - clippedPixels
    this.eyelids(eyeOpen)
    for (const jewelry of this.jewelry) {
      const angle = sampleMotion(table, timeMs, jewelry.channel) * 0.22 * gain
      const cosine = Math.cos(angle), sine = Math.sin(angle)
      const spine = jewelry.mesh.material.spine
      for (let node = 0; node < HAIR_NODES; node += 1) {
        const x = spine[node * 2]! - jewelry.root[0], y = spine[node * 2 + 1]! - jewelry.root[1]
        jewelry.pose[node * 2] = jewelry.root[0] + x * cosine - y * sine
        jewelry.pose[node * 2 + 1] = jewelry.root[1] + x * sine + y * cosine
      }
      jewelry.mesh.update(jewelry.pose)
      jewelry.mesh.draw(this.target)
    }
    for (const lock of this.drawOrder) {
      if (this.materials.locks[lock]!.z >= 0) this.meshes[lock]!.draw(this.target)
    }
    ctx.putImageData(this.output, 0, 0)
  }

  destroy(): void {
    this.preparation += 1
    this.physics = null
  }
}
