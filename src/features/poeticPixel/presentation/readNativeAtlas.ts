const MAX_ATLAS_PIXELS = 8_388_608

const abortError = (): DOMException => new DOMException('Pixel scene loading was cancelled.', 'AbortError')

/** Read the compact native atlas once, then release all temporary image surfaces. */
export const readNativeAtlas = async (image: HTMLImageElement, signal: AbortSignal) => {
  let bitmap: ImageBitmap | null = null
  let scratch: HTMLCanvasElement | undefined
  try {
    const width = image.naturalWidth, height = image.naturalHeight
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > MAX_ATLAS_PIXELS) {
      throw new RangeError('Invalid native pixel atlas dimensions.')
    }
    if (signal.aborted) throw abortError()
    if (typeof createImageBitmap === 'function') {
      try { bitmap = await createImageBitmap(image) } catch { /* Decoded image fallback. */ }
    }
    if (signal.aborted) throw abortError()
    scratch = document.createElement('canvas')
    scratch.width = width
    scratch.height = height
    const reader = scratch.getContext('2d', { willReadFrequently: true })
    if (!reader) throw new Error('Native pixel atlas readback is unavailable.')
    reader.imageSmoothingEnabled = false
    reader.drawImage(bitmap ?? image, 0, 0)
    const pixels = reader.getImageData(0, 0, width, height)
    return { data: pixels.data, width, height }
  } finally {
    bitmap?.close()
    image.removeAttribute('src')
    if (scratch) scratch.width = scratch.height = 1
  }
}
