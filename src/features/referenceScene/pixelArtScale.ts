/** Two-times edge reconstruction using only existing source colors (Scale2x).
 *
 * A source pixel remains the unique most frequent color of its 2x2 output block.
 * This refines diagonal steps, but does not recover detail absent from the source.
 */
const MAX_SOURCE_PIXELS = 1024 * 1024
const CACHE_FRAMES = 4

const validateDimensions = (width: number, height: number): number => {
  const pixels = width * height
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || pixels > MAX_SOURCE_PIXELS) {
    throw new RangeError('Invalid source dimensions for pixel reconstruction.')
  }
  return pixels
}

export const scale2xPixels = (
  source: Uint8ClampedArray,
  width: number,
  height: number,
  destination = new Uint8ClampedArray(validateDimensions(width, height) * 16),
): Uint8ClampedArray => {
  const pixels = validateDimensions(width, height)
  if (source.length !== pixels * 4 || destination.length !== pixels * 16) {
    throw new RangeError('Pixel buffers do not match their dimensions.')
  }
  if (source.buffer === destination.buffer && source.byteOffset < destination.byteOffset + destination.byteLength &&
    destination.byteOffset < source.byteOffset + source.byteLength) {
    throw new RangeError('Source and destination pixel buffers must not overlap.')
  }
  // ImageData is aligned; accept unaligned external views without unsafe reads.
  const alignedSource = source.byteOffset % 4 === 0 ? source : new Uint8ClampedArray(source)
  const alignedDestination = destination.byteOffset % 4 === 0 ? destination : new Uint8ClampedArray(destination.length)
  const input = new Uint32Array(alignedSource.buffer, alignedSource.byteOffset, pixels)
  const output = new Uint32Array(alignedDestination.buffer, alignedDestination.byteOffset, pixels * 4)
  const outputWidth = width * 2
  for (let y = 0; y < height; y++) {
    const row = y * width
    const above = (y > 0 ? y - 1 : y) * width
    const below = (y < height - 1 ? y + 1 : y) * width
    let at = y * 2 * outputWidth
    for (let x = 0; x < width; x++, at += 2) {
      const center = input[row + x]!, north = input[above + x]!, south = input[below + x]!
      const west = input[row + (x > 0 ? x - 1 : x)]!, east = input[row + (x < width - 1 ? x + 1 : x)]!
      if (north !== south && west !== east) {
        output[at] = west === north ? west : center
        output[at + 1] = north === east ? east : center
        output[at + outputWidth] = west === south ? west : center
        output[at + outputWidth + 1] = south === east ? east : center
      } else {
        output[at] = center
        output[at + 1] = center
        output[at + outputWidth] = center
        output[at + outputWidth + 1] = center
      }
    }
  }
  if (alignedDestination !== destination) destination.set(alignedDestination)
  return destination
}

type CacheEntry = {
  source: CanvasImageSource | null
  sx: number
  sy: number
  key: string | number | undefined
  lastUsed: number
  pixels: ImageData
}

/** Keep only four reusable output buffers; never build a 160-frame HD atlas. */
export const createPixelScaler = (nativeWidth: number, nativeHeight: number) => {
  validateDimensions(nativeWidth, nativeHeight)
  const scratch = document.createElement('canvas')
  scratch.width = nativeWidth
  scratch.height = nativeHeight
  const sample = scratch.getContext('2d', { willReadFrequently: true })
  if (!sample) throw new Error('Pixel reconstruction requires a Canvas 2D context.')
  sample.imageSmoothingEnabled = false
  const slots: CacheEntry[] = []
  let age = 0
  let destroyed = false
  return {
    paint(context: CanvasRenderingContext2D, source: CanvasImageSource, sx = 0, sy = 0, key?: string | number): void {
      if (destroyed) throw new Error('Pixel reconstruction has been disposed.')
      if (!Number.isInteger(sx) || !Number.isInteger(sy) || sx < 0 || sy < 0 ||
        context.canvas.width !== nativeWidth * 2 || context.canvas.height !== nativeHeight * 2) {
        throw new RangeError('Pixel reconstruction requires an aligned source tile and a two-times destination.')
      }
      let slot = slots.find(entry => entry.source === source && entry.sx === sx && entry.sy === sy && entry.key === key)
      if (!slot) {
        if (slots.length < CACHE_FRAMES) {
          slot = { source: null, sx, sy, key, lastUsed: 0, pixels: new ImageData(nativeWidth * 2, nativeHeight * 2) }
          slots.push(slot)
        } else slot = slots.reduce((oldest, entry) => entry.lastUsed < oldest.lastUsed ? entry : oldest)
        // Clear first so alpha in future transparent materials cannot retain a
        // preceding opaque frame. ImageData writes preserve each RGBA source color.
        sample.clearRect(0, 0, nativeWidth, nativeHeight)
        sample.drawImage(source, sx, sy, nativeWidth, nativeHeight, 0, 0, nativeWidth, nativeHeight)
        const native = sample.getImageData(0, 0, nativeWidth, nativeHeight)
        scale2xPixels(native.data, nativeWidth, nativeHeight, slot.pixels.data)
        slot.source = source
        slot.sx = sx
        slot.sy = sy
        slot.key = key
      }
      slot.lastUsed = ++age
      // putImageData bypasses display filtering and copies the reconstructed grid
      // directly. Source draw, weather and display layout remain separate concerns.
      context.imageSmoothingEnabled = false
      context.putImageData(slot.pixels, 0, 0)
    },
    destroy(): void {
      destroyed = true
      slots.length = 0
      scratch.width = 1
      scratch.height = 1
    },
  }
}
