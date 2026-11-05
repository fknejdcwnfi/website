/** Offline native-resolution indexed conversion. Never imported by the player. */
type Color = readonly [number, number, number]
const WIDTH = 358
const HEIGHT = 267

function paletteOf(frames: readonly Uint8ClampedArray[]): Color[] {
  const colors = new Map<number, Color>()
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i += 4) {
      const r = frame[i]!, g = frame[i + 1]!, b = frame[i + 2]!
      colors.set(r << 16 | g << 8 | b, [r, g, b])
    }
  }
  // The GIF has only 255 colors across all 16 frames. Keep every one; fitting
  // a smaller palette or a five-bit histogram would discard source detail.
  if (colors.size > 256) throw Error('Source colors exceed a lossless indexed palette.')
  return [...colors.entries()].sort(([a], [b]) => a - b).map(([, color]) => color)
}

const encode = (canvas: HTMLCanvasElement) => canvas.toDataURL('image/png').split(',')[1]!

export function authorSourceSequence(images: HTMLImageElement[], gridWidth = WIDTH, paletteSize = 256, paletteHex?: readonly string[]) {
  if (!images.length || images.length > 512 || images.some(image => image.naturalWidth !== WIDTH || image.naturalHeight !== HEIGHT)) {
    throw Error('The reference source requires consistently sized 358×267 frames.')
  }
  if (gridWidth !== WIDTH || paletteSize !== 256) {
    throw Error('Keep the source-native pixel grid and an indexed PNG palette of at most 256 colors.')
  }
  const sample = document.createElement('canvas')
  sample.width = WIDTH; sample.height = HEIGHT
  const context = sample.getContext('2d', { willReadFrequently: true })!
  context.imageSmoothingEnabled = false
  const inputs = images.map(image => {
    context.drawImage(image, 0, 0)
    return context.getImageData(0, 0, WIDTH, HEIGHT).data
  })
  const palette: Color[] = paletteHex ? paletteHex.map(color => {
    if (!/^#[a-f0-9]{6}$/i.test(color)) throw Error('Invalid shared palette.')
    return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)]
  }) : paletteOf(inputs)
  if (!palette.length || palette.length > 256) throw Error('Invalid shared palette size.')
  const lookup = new Map<number, number>()
  palette.forEach(([r, g, b], index) => lookup.set(r << 16 | g << 8 | b, index))
  const columns = Math.min(16, 2 ** Math.ceil(Math.log2(Math.sqrt(images.length))))
  const rows = Math.ceil(images.length / columns)
  const atlas = document.createElement('canvas')
  atlas.width = WIDTH * columns; atlas.height = HEIGHT * rows
  const packed = atlas.getContext('2d', { willReadFrequently: true })!
  packed.imageSmoothingEnabled = false
  const checksums: number[] = [], frames: string[] = []
  let atlasMismatches = 0
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index]!, rgba = new Uint8ClampedArray(input.length)
    for (let i = 0; i < input.length; i += 4) {
      const r = input[i]!, g = input[i + 1]!, b = input[i + 2]!, key = r << 16 | g << 8 | b
      let p = lookup.get(key)
      if (p === undefined) {
        let best = Infinity
        p = 0
        for (let k = 0; k < palette.length; k++) {
          const color = palette[k]!
          const distance = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2
          if (distance < best) { best = distance; p = k }
        }
        lookup.set(key, p)
      }
      const color = palette[p]!
      rgba[i] = color[0]; rgba[i + 1] = color[1]; rgba[i + 2] = color[2]; rgba[i + 3] = 255
    }
    context.putImageData(new ImageData(rgba, WIDTH, HEIGHT), 0, 0)
    const x = index % columns * WIDTH, y = Math.floor(index / columns) * HEIGHT
    packed.drawImage(sample, x, y)
    const actual = packed.getImageData(x, y, WIDTH, HEIGHT).data
    for (let i = 0; i < rgba.length; i++) if (rgba[i] !== actual[i]) atlasMismatches++
    let checksum = 2166136261
    for (const value of rgba) checksum = Math.imul(checksum ^ value, 16777619)
    checksums.push(checksum >>> 0)
    if (!index) frames.push(encode(sample))
  }
  return {
    atlas: encode(atlas), frames, palette: palette.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')),
    width: WIDTH, height: HEIGHT, contentHeight: HEIGHT, gridWidth: WIDTH, gridHeight: HEIGHT,
    tileWidth: WIDTH, tileHeight: HEIGHT, columns, rows, checksums, atlasMismatches,
  }
}
