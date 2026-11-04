import { HairPhysics, type HairPhysicsCache } from './hairPhysics'
import { hasBakedPhysics, loadBakedPhysics } from './bakedPhysics'
import type { HairMaterial, HairPhysicsConfig } from './hairTypes'

/** Shared finite preparation survives React's development remount without duplicate workers. */
const prepared = new Map<string, Promise<HairPhysicsCache>>()

const prepare = (locks: readonly HairMaterial[], config: HairPhysicsConfig, size: number): Promise<HairPhysicsCache> =>
  new Promise((resolve, reject) => {
    let worker: Worker
    try { worker = new Worker(new URL('./hairPhysics.worker.ts', import.meta.url), { type: 'module' }) }
    catch { reject(new Error('Background hair preparation is unavailable.')); return }
    const finish = (): void => { clearTimeout(timeout); worker.terminate() }
    const timeout = window.setTimeout(() => {
      finish()
      reject(new Error('Background hair preparation timed out.'))
    }, 20_000)
    worker.onerror = (): void => { finish(); reject(new Error('Background hair preparation failed.')) }
    worker.onmessage = ({ data }: MessageEvent<{ cache?: HairPhysicsCache; error?: string }>): void => {
      finish()
      if (data.cache) resolve(data.cache)
      else reject(new Error(data.error ?? 'Invalid physical hair cache.'))
    }
    worker.postMessage({
      locks: locks.map(({ id, side, spine, motion }) => ({ id, side, spine, motion })), config, size,
    })
  })

/** All numerical warmup happens off the main thread; runtime only interpolates poses. */
export const prepareHairPhysics = async (
  locks: readonly HairMaterial[], config: HairPhysicsConfig, size: number,
): Promise<HairPhysics> => {
  const scale = size / 256
  const parameters: HairPhysicsConfig = {
    direction: config.direction, gust: config.gust, stiffness: config.stiffness, damping: config.damping,
  }
  const key = JSON.stringify([size, parameters, locks.map(({ spine, side, motion }) => [
    side, motion, Array.from(spine, (value) => Math.round(value / scale * 1000) / 1000),
  ])])
  let pending = prepared.get(key)
  if (!pending) {
    if (prepared.size >= 2) prepared.delete(prepared.keys().next().value!)
    // The homepage's default wind does not depend on Worker support. A damaged
    // or unavailable baked asset still has the numerical preparation route.
    pending = hasBakedPhysics(parameters, size)
      ? loadBakedPhysics(locks, size).catch(() => prepare(locks, parameters, size))
      : prepare(locks, parameters, size)
    prepared.set(key, pending)
    void pending.catch(() => { if (prepared.get(key) === pending) prepared.delete(key) })
  }
  return new HairPhysics(locks, parameters, size, await pending)
}
