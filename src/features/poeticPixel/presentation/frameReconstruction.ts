import { scale2xPixels } from '../../referenceScene/pixelArtScale'

const CACHE_SLOTS = 2
// The second pass is also constrained by scale2xPixels' 1M-input-pixel bound.
const MAX_NATIVE_PIXELS = 262_144
type Slot = {
  source: CanvasImageSource | null
  sx: number
  sy: number
  key: string | number | undefined
  used: number
  pixels: ImageData
}

/**
 * Refine source-colour staircases twice, without interpolated display colours.
 * Only two output frames and one shared first-pass buffer are retained. The
 * source must be immutable for a given key; no full-resolution atlas is built.
 */
export const createFrameReconstruction = (nativeWidth = 358, nativeHeight = 267) => {
  const count = nativeWidth * nativeHeight
  if (!Number.isSafeInteger(nativeWidth) || !Number.isSafeInteger(nativeHeight) ||
    nativeWidth < 1 || nativeHeight < 1 || nativeWidth > 2048 || nativeHeight > 2048 || count > MAX_NATIVE_PIXELS) {
    throw new RangeError('Invalid source grid for frame reconstruction.')
  }
  const scratch = document.createElement('canvas')
  scratch.width = nativeWidth
  scratch.height = nativeHeight
  const reader = scratch.getContext('2d', { willReadFrequently: true })
  if (!reader) throw new Error('Frame reconstruction requires a Canvas2D context.')
  reader.imageSmoothingEnabled = false
  let intermediate = new Uint8ClampedArray(count * 16)
  const slots: Slot[] = []
  let age = 0
  let destroyed = false
  const width = nativeWidth * 4
  const height = nativeHeight * 4
  return {
    width,
    height,
    paint(context: CanvasRenderingContext2D, source: CanvasImageSource, sx = 0, sy = 0, key?: string | number): void {
      if (destroyed) throw new Error('Frame reconstruction has been disposed.')
      if (context.canvas.width !== width || context.canvas.height !== height ||
        !Number.isInteger(sx) || !Number.isInteger(sy) || sx < 0 || sy < 0) {
        throw new RangeError('Frame reconstruction needs an aligned source tile and a four-times output grid.')
      }
      let slot: Slot | undefined
      for (const candidate of slots) {
        if (candidate.source === source && candidate.sx === sx && candidate.sy === sy && candidate.key === key) {
          slot = candidate
          break
        }
      }
      if (!slot) {
        if (slots.length < CACHE_SLOTS) {
          slot = { source: null, sx, sy, key, used: 0, pixels: new ImageData(width, height) }
          slots.push(slot)
        } else slot = slots[0]!.used <= slots[1]!.used ? slots[0]! : slots[1]!
        reader.clearRect(0, 0, nativeWidth, nativeHeight)
        reader.drawImage(source, sx, sy, nativeWidth, nativeHeight, 0, 0, nativeWidth, nativeHeight)
        const native = reader.getImageData(0, 0, nativeWidth, nativeHeight)
        scale2xPixels(native.data, nativeWidth, nativeHeight, intermediate)
        scale2xPixels(intermediate, nativeWidth * 2, nativeHeight * 2, slot.pixels.data)
        slot.source = source
        slot.sx = sx
        slot.sy = sy
        slot.key = key
      }
      slot.used = ++age
      context.imageSmoothingEnabled = false
      context.putImageData(slot.pixels, 0, 0)
    },
    destroy(): void {
      if (destroyed) return
      destroyed = true
      slots.length = 0
      intermediate = new Uint8ClampedArray(0)
      scratch.width = scratch.height = 1
    },
  }
}
