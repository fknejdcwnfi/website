import { scale2xPixels } from '../../referenceScene/pixelArtScale.ts'

const CACHE_SLOTS = 2
// The second pass is also constrained by scale2xPixels' 1M-input-pixel bound.
const MAX_NATIVE_PIXELS = 262_144
const MAX_ATLAS_PIXELS = 8_388_608

type NativeAtlas = Readonly<Pick<ImageData, 'data' | 'width' | 'height'>>
type Slot = {
  sx: number
  sy: number
  key: string | number | undefined
  used: number
  pixels: ImageData
}

/**
 * Refine source-colour staircases twice, without interpolated display colours.
 * The immutable native atlas is read once before construction. Read the first
 * pass directly from its bounded tile, retaining only two four-times outputs.
 */
export const createFrameReconstruction = (atlas: NativeAtlas, nativeWidth = 358, nativeHeight = 267) => {
  const count = nativeWidth * nativeHeight
  if (!Number.isSafeInteger(nativeWidth) || !Number.isSafeInteger(nativeHeight) ||
    nativeWidth < 1 || nativeHeight < 1 || nativeWidth > 2048 || nativeHeight > 2048 || count > MAX_NATIVE_PIXELS) {
    throw new RangeError('Invalid source grid for frame reconstruction.')
  }
  const sourceWidth = atlas.width, sourceHeight = atlas.height
  const sourceCount = sourceWidth * sourceHeight
  if (!Number.isSafeInteger(sourceWidth) || !Number.isSafeInteger(sourceHeight) ||
    sourceWidth < nativeWidth || sourceHeight < nativeHeight || sourceWidth > 8192 || sourceHeight > 8192 ||
    sourceCount > MAX_ATLAS_PIXELS || !(atlas.data instanceof Uint8ClampedArray) ||
    atlas.data.length !== sourceCount * 4 || atlas.data.byteOffset % 4 !== 0) {
    throw new RangeError('Invalid native atlas pixels for frame reconstruction.')
  }
  let source = new Uint32Array(atlas.data.buffer, atlas.data.byteOffset, sourceCount)
  let intermediate = new Uint8ClampedArray(count * 16)
  let firstPass = new Uint32Array(intermediate.buffer)
  const slots: Slot[] = []
  let age = 0
  let destroyed = false
  const width = nativeWidth * 4, height = nativeHeight * 4
  const firstWidth = nativeWidth * 2
  return {
    width,
    height,
    paint(context: CanvasRenderingContext2D, sx = 0, sy = 0, key?: string | number): void {
      if (destroyed) throw new Error('Frame reconstruction has been disposed.')
      if (context.canvas.width !== width || context.canvas.height !== height ||
        !Number.isSafeInteger(sx) || !Number.isSafeInteger(sy) || sx < 0 || sy < 0 ||
        sx + nativeWidth > sourceWidth || sy + nativeHeight > sourceHeight) {
        throw new RangeError('Frame reconstruction needs a bounded source tile and a four-times output grid.')
      }
      let slot: Slot | undefined
      for (const candidate of slots) {
        if (candidate.sx === sx && candidate.sy === sy && candidate.key === key) {
          slot = candidate
          break
        }
      }
      if (!slot) {
        if (slots.length < CACHE_SLOTS) {
          slot = { sx, sy, key, used: 0, pixels: new ImageData(width, height) }
          slots.push(slot)
        } else slot = slots[0]!.used <= slots[1]!.used ? slots[0]! : slots[1]!
        // Apply exactly the existing Scale2x rule. Clamp neighbors to this tile,
        // so an adjacent atlas frame can never influence its boundary pixels.
        for (let y = 0; y < nativeHeight; y++) {
          const row = (sy + y) * sourceWidth + sx
          const above = (sy + (y > 0 ? y - 1 : y)) * sourceWidth + sx
          const below = (sy + (y < nativeHeight - 1 ? y + 1 : y)) * sourceWidth + sx
          let at = y * 2 * firstWidth
          for (let x = 0; x < nativeWidth; x++, at += 2) {
            const center = source[row + x]!, north = source[above + x]!, south = source[below + x]!
            const west = source[row + (x > 0 ? x - 1 : x)]!, east = source[row + (x < nativeWidth - 1 ? x + 1 : x)]!
            if (north !== south && west !== east) {
              firstPass[at] = west === north ? west : center
              firstPass[at + 1] = north === east ? east : center
              firstPass[at + firstWidth] = west === south ? west : center
              firstPass[at + firstWidth + 1] = south === east ? east : center
            } else {
              firstPass[at] = center
              firstPass[at + 1] = center
              firstPass[at + firstWidth] = center
              firstPass[at + firstWidth + 1] = center
            }
          }
        }
        scale2xPixels(intermediate, nativeWidth * 2, nativeHeight * 2, slot.pixels.data)
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
      source = new Uint32Array(0)
      firstPass = new Uint32Array(0)
      intermediate = new Uint8ClampedArray(0)
    },
  }
}
