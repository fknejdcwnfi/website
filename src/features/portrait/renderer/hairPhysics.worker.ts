import { HairPhysics } from './hairPhysics'
import type { HairMaterial, HairPhysicsConfig } from './hairTypes'

type Input = {
  locks: Pick<HairMaterial, 'id' | 'side' | 'spine' | 'motion'>[]
  config: HairPhysicsConfig
  size: number
}

const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Input>) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

worker.onmessage = ({ data }): void => {
  try {
    const locks: HairMaterial[] = data.locks.map((lock, z) => ({
      ...lock, z, pixels: new Uint32Array(0), bounds: { x0: 0, y0: 0, x1: 0, y1: 0 },
    }))
    const physics = new HairPhysics(locks, data.config, data.size)
    const cache = physics.exportCache()
    const transfer = [...cache.rest, ...cache.poses].map((array) => array.buffer as ArrayBuffer)
    worker.postMessage({ cache }, transfer)
  } catch (error) {
    worker.postMessage({ error: error instanceof Error ? error.message : 'Unable to prepare hair physics.' })
  }
}
