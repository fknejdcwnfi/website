import { loadImage } from './portraitAsset'
import { HAIR_NODES, type HairMaterial, type PortraitMaterials } from './hairTypes'

type MaterialRecord = Omit<HairMaterial, 'pixels' | 'spine'> & { tile: number; spine: number[] }
type Bundle = {
  version: number; size: number; columns: number; rows: number
  atlas: string; atlas_sha256: string
  tiles: { canonical: number; closed: number; clean: number; repair: number; masks: number }
  locks: MaterialRecord[]
  shadows: { id: string; lock: number; material: MaterialRecord }[]
}

const checkBundle = (input: unknown, size: number): Bundle => {
  if (!input || typeof input !== 'object') throw new Error('Invalid portrait bundle.')
  const data = input as Bundle
  if (data.version !== 1 || data.size !== size || data.columns !== 4 ||
    !Array.isArray(data.locks) || !data.locks.length || data.locks.length > 16 ||
    !Array.isArray(data.shadows) || data.shadows.length > 16 ||
    data.rows !== Math.ceil((5 + data.locks.length + data.shadows.length) / 4) ||
    data.atlas !== `rig-${size}.png` || !/^[a-f0-9]{64}$/.test(data.atlas_sha256)) {
    throw new Error('Unsupported portrait bundle layout.')
  }
  const used = new Set<number>()
  const checkTile = (tile: number): void => {
    if (!Number.isInteger(tile) || tile < 0 || tile >= data.columns * data.rows || used.has(tile)) throw new Error('Invalid portrait tile.')
    used.add(tile)
  }
  if (!data.tiles) throw new Error('Missing portrait surfaces.')
  for (const name of ['canonical', 'closed', 'clean', 'repair', 'masks'] as const) checkTile(data.tiles[name])
  const checkMaterial = (item: MaterialRecord): void => {
    if (!item || typeof item.id !== 'string' || !item.id.length || item.id.length > 80 ||
      !Number.isFinite(item.z) || ![-1, 1].includes(item.side) ||
      !Array.isArray(item.spine) || item.spine.length !== HAIR_NODES * 2 ||
      !item.spine.every(value => Number.isFinite(value) && Math.abs(value) <= size * 2)) throw new Error('Invalid hair binding.')
    const b = item.bounds
    if (!b || ![b.x0, b.y0, b.x1, b.y1].every(value => Number.isInteger(value) && value >= 0 && value < size) ||
      b.x0 > b.x1 || b.y0 > b.y1) throw new Error('Invalid hair bounds.')
    const m = item.motion
    if (!m || ![m.mass, m.drag, m.bend, m.wind].every(value => Number.isFinite(value) && value >= 0 && value <= 10)) throw new Error('Invalid hair material.')
    checkTile(item.tile)
  }
  data.locks.forEach(checkMaterial)
  for (const shadow of data.shadows) {
    if (!shadow || typeof shadow.id !== 'string' || !Number.isInteger(shadow.lock) || shadow.lock < 0 || shadow.lock >= data.locks.length) throw new Error('Invalid shadow binding.')
    checkMaterial(shadow.material)
  }
  return data
}

/** Decode authoring-time cutouts, without segmenting or repairing images at startup. */
export const loadBakedMaterials = async (base: string, size: number, timeoutMs = 12_000): Promise<PortraitMaterials> => {
  if (![192, 256, 320].includes(size)) throw new Error('Unsupported portrait grid.')
  const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12_000
  const start = performance.now(), controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), duration)
  try {
    const response = await fetch(`${base}rig-${size}.json`, { signal: controller.signal, cache: 'no-cache' })
    if (!response.ok) throw new Error('Unable to load portrait bindings.')
    const bundle = checkBundle(await response.json(), size)
    const image = await loadImage(`${base}${bundle.atlas}?v=${bundle.atlas_sha256}`, Math.max(1, duration - (performance.now() - start)))
    const width = size * bundle.columns, height = size * bundle.rows
    if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error('Portrait atlas dimensions do not match.')
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Unable to read portrait atlas.')
    context.imageSmoothingEnabled = false
    context.drawImage(image, 0, 0)
    const atlas = new Uint32Array(context.getImageData(0, 0, width, height).data.buffer)
    const tile = (index: number): Uint32Array => {
      const x = index % bundle.columns * size, y = Math.floor(index / bundle.columns) * size
      const output = new Uint32Array(size * size)
      for (let row = 0; row < size; row += 1) output.set(atlas.subarray((y + row) * width + x, (y + row) * width + x + size), row * size)
      return output
    }
    const material = (item: MaterialRecord): HairMaterial => ({
      id: item.id, z: item.z, side: item.side, bounds: item.bounds, motion: item.motion,
      spine: new Float32Array(item.spine), pixels: tile(item.tile),
    })
    const packed = tile(bundle.tiles.masks)
    const ownership = new Int16Array(packed.length), faceMask = new Uint8Array(packed.length), bodyMask = new Uint8Array(packed.length)
    for (let index = 0; index < packed.length; index += 1) {
      const value = packed[index]!, owner = value & 255, face = value >>> 8 & 255, body = value >>> 16 & 255
      if (value >>> 24 !== 255 || owner > bundle.locks.length || ![0, 255].includes(face) || ![0, 255].includes(body)) throw new Error('Invalid portrait selection data.')
      ownership[index] = owner - 1; faceMask[index] = face ? 1 : 0; bodyMask[index] = body ? 1 : 0
    }
    return {
      size, canonical: tile(bundle.tiles.canonical), closed: tile(bundle.tiles.closed),
      clean: tile(bundle.tiles.clean), repair: tile(bundle.tiles.repair), ownership, faceMask, bodyMask,
      locks: bundle.locks.map(material),
      shadows: bundle.shadows.map(item => ({ id: item.id, lock: item.lock, material: material(item.material) })),
    }
  } finally { clearTimeout(timeout) }
}
