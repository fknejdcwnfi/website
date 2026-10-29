/** Shared export/runtime palette. Art is deliberately redrawn before grid normalization. */
export const PALETTE = [
  '#071222', '#0b1b2b', '#102536', '#242329', '#403835', '#554640',
  '#463f3c', '#5b524b', '#71675b', '#887a67', '#9f8d73', '#b4a183',
  '#cab594', '#ddc6a2', '#eed4ad', '#f8dfb8', '#ffeac7',
  '#785b54', '#966b5e', '#b4816d', '#c99a80', '#d5ab90', '#e2b99b',
  '#ebc4a5', '#f2d0b1', '#f7d8b9', '#ffe0c1',
  '#0a1b2e', '#113954', '#155a7e', '#1b75a6', '#2d95c3', '#56b9d7', '#a4e2e6', '#eff6e8',
  '#783b3d', '#a54643', '#c95b50', '#e47b64', '#74746f', '#aaa595', '#d1c4aa',
] as const

export const RGB = PALETTE.map((hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)))

export const loadImage = (url: string, timeoutMs = 12_000): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image()
  const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12_000
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const finish = (error?: Error): void => {
    if (settled) return
    settled = true
    if (timer !== undefined) clearTimeout(timer)
    image.onload = null
    image.onerror = null
    if (error) reject(error)
    else resolve(image)
  }
  image.decoding = 'async'
  image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0
    ? undefined : new Error(`Invalid portrait artwork: ${url}`))
  image.onerror = () => finish(new Error(`Unable to load portrait artwork: ${url}`))
  timer = setTimeout(() => {
    finish(new Error(`Timed out loading portrait artwork: ${url}`))
    image.removeAttribute('src')
  }, duration)
  image.src = url
})

/** Keep the owner's original square close-up scale; only the silhouette is visible. */
export const portraitHeight = (width: number): number => width

/** Used by the asset export page, never to pixelate the original anime photograph. */
export const normalizeArtwork = (image: CanvasImageSource, size: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  const height = portraitHeight(size)
  canvas.width = size
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  // Preserve the original close-up composition and character scale exactly.
  ctx.drawImage(image, 0, 0, size, height)
  const output = ctx.getImageData(0, 0, size, height)
  const lookup = new Map<number, number>()
  for (let i = 0; i < output.data.length; i += 4) {
    // Binary alpha preserves stepped pixel edges and removes transparent RGB fringes.
    if (output.data[i + 3]! < 192) {
      output.data.fill(0, i, i + 4)
      continue
    }
    const r = output.data[i]!, g = output.data[i + 1]!, b = output.data[i + 2]!
    const key = r << 16 | g << 8 | b
    let best = lookup.get(key)
    if (best === undefined) {
      let distance = Infinity
      best = 0
      RGB.forEach((color, index) => {
        const error = 0.9 * (r - color[0]!) ** 2 + (g - color[1]!) ** 2 + 0.8 * (b - color[2]!) ** 2
        if (error < distance) { distance = error; best = index }
      })
      lookup.set(key, best)
    }
    output.data[i] = RGB[best]![0]!
    output.data[i + 1] = RGB[best]![1]!
    output.data[i + 2] = RGB[best]![2]!
    output.data[i + 3] = 255
  }
  ctx.putImageData(output, 0, 0)
  return canvas
}
