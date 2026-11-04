import { HAIR_NODES, type HairMaterial, type HairPhysicsConfig } from './hairTypes'
import type { HairPhysicsCache } from './hairPhysics'
import { bakedPhysicsConfig, bakedPhysicsManifest } from './bakedPhysicsManifest'

const sha256 = async (data: ArrayBuffer): Promise<string> => Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', data)), value => value.toString(16).padStart(2, '0'),
).join('')

export const hasBakedPhysics = (config: HairPhysicsConfig, size: number): boolean =>
  size in bakedPhysicsManifest && (Object.keys(bakedPhysicsConfig) as (keyof HairPhysicsConfig)[])
    .every(key => config[key] === bakedPhysicsConfig[key])

/** Read the exact default cycle without requiring module Workers or numerical warmup. */
export const loadBakedPhysics = async (locks: readonly HairMaterial[], size: number): Promise<HairPhysicsCache> => {
  const descriptor = bakedPhysicsManifest[String(size) as keyof typeof bakedPhysicsManifest]
  if (!descriptor || locks.length !== descriptor.locks) throw new Error('Unsupported baked hair cycle.')
  const scale = size / 256
  const binding = JSON.stringify(locks.map(({ side, spine, motion }) => [side, motion,
    Array.from(spine, value => Math.round(value / scale * 1000) / 1000)]))
  const bindingBytes = new TextEncoder().encode(binding)
  if (await sha256(bindingBytes.buffer) !== descriptor.bindingSha256) throw new Error('Baked hair bindings are outdated.')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}assets/portrait-rig/${descriptor.file}`, { signal: controller.signal })
    if (!response.ok) throw new Error('Unable to load baked hair cycle.')
    const data = await response.arrayBuffer()
    if (data.byteLength !== descriptor.bytes || await sha256(data) !== descriptor.sha256) throw new Error('Baked hair integrity mismatch.')
    const view = new DataView(data)
    if (new TextDecoder().decode(new Uint8Array(data, 0, 8)) !== 'VHCPv001'
      || view.getUint32(8, true) !== locks.length || view.getUint32(12, true) !== HAIR_NODES
      || view.getUint32(16, true) !== descriptor.frames || view.getUint32(20, true) !== HAIR_NODES * 2) throw new Error('Invalid baked hair header.')
    const diagnostics = [24, 32, 40].map(offset => view.getFloat64(offset, true))
    if (diagnostics.some(value => !Number.isFinite(value) || value < 0 || value > 1024)) throw new Error('Invalid baked hair diagnostics.')
    let offset = 64
    const take = (count: number): Float32Array => {
      const array = new Float32Array(count)
      for (let index = 0; index < count; index += 1) {
        const value = view.getFloat32(offset, true); offset += 4
        if (!Number.isFinite(value) || Math.abs(value) > 1024) throw new Error('Invalid baked hair coordinate.')
        array[index] = value
      }
      return array
    }
    const rest = locks.map(() => take(HAIR_NODES * 2))
    const poses = locks.map(() => take(descriptor.frames * HAIR_NODES * 2))
    for (let lock = 0; lock < locks.length; lock += 1) {
      const source = locks[lock]!.spine, anchor = rest[lock]!, table = poses[lock]!
      for (let index = 0; index < anchor.length; index += 1) {
        if (Math.abs(anchor[index]! - source[index]! / scale) > .0001) throw new Error('Invalid baked hair rest binding.')
        if (table[index] !== table[(descriptor.frames - 1) * anchor.length + index]) throw new Error('Baked hair loop is not closed.')
      }
      for (let frame = 0; frame < descriptor.frames; frame += 1) for (let index = 0; index < 4; index += 1) {
        if (table[frame * anchor.length + index] !== anchor[index]) throw new Error('Baked hair anchors have moved.')
      }
    }
    if (offset !== data.byteLength) throw new Error('Unexpected baked hair data.')
    return { rest, poses, maxLengthError: diagnostics[0]!, maxSeamDistance: diagnostics[1]!, maxDisplacement: diagnostics[2]! }
  } finally { window.clearTimeout(timeout) }
}
