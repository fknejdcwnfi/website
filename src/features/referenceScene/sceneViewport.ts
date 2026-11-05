export type SceneViewport = {
  diameter: number
  /** Physical device pixels per original source pixel. */
  scale: number
  offsetX: number
  offsetY: number
  integerScale: boolean
}

/** Preserve native source pixels where they fit, without shrinking mobile art excessively. */
export const fitSceneViewport = (
  availableWidth: number,
  left: number,
  top: number,
  sourceWidth: number,
  sourceHeight: number,
  deviceScale: number,
): SceneViewport => {
  const ratio = Number.isFinite(deviceScale) && deviceScale > 0 ? deviceScale : 1
  const rows = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 534
  const columns = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 716
  const available = Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : 1
  // A cover-fit square is scaled by its shorter source dimension. The source
  // is kept at its authored resolution; the full composition remains untouched.
  const grid = Math.min(columns, rows)
  const wholeScale = Math.floor((available * ratio + 1e-7) / grid)
  const wholeDiameter = wholeScale * grid / ratio
  const integerScale = wholeScale > 0 && wholeDiameter >= available * .82
  const diameter = integerScale ? wholeDiameter : available
  const scale = diameter * ratio / grid
  const inset = (available - diameter) / 2
  // Align the source texture, not just its circular viewport. A 358x267 image
  // at an odd multiplier has a half-device-pixel horizontal cover crop.
  const sourceLeft = ((Number.isFinite(left) ? left : 0) + inset) * ratio - (columns - grid) * scale / 2
  const sourceTop = ((Number.isFinite(top) ? top : 0) + inset) * ratio - (rows - grid) * scale / 2
  return {
    diameter,
    scale,
    integerScale,
    offsetX: (Math.round(sourceLeft) - sourceLeft) / ratio,
    offsetY: (Math.round(sourceTop) - sourceTop) / ratio,
  }
}
