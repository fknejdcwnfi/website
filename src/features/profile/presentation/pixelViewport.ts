export type PixelViewport = {
  diameter: number
  scale: number
  offsetX: number
  offsetY: number
}

/** Fit whole device pixels to each art pixel, then align its origin to that grid. */
export const fitPixelViewport = (
  availableWidth: number,
  left: number,
  top: number,
  logicalSize: number,
  deviceScale: number,
  maximumDiameter = 512,
): PixelViewport => {
  const ratio = Number.isFinite(deviceScale) && deviceScale > 0 ? deviceScale : 1
  const grid = Number.isFinite(logicalSize) && logicalSize > 0 ? logicalSize : 256
  const available = Math.max(1, Math.min(availableWidth, maximumDiameter))
  const wholeScale = Math.floor(available * ratio / grid)
  // Very small / zoomed-out viewports may not fit even one physical pixel per
  // art pixel. Fit those safely; normal supported widths use a whole multiplier.
  const physicalDiameter = wholeScale > 0 ? grid * wholeScale : Math.max(1, Math.floor(available * ratio))
  const diameter = physicalDiameter / ratio
  const origin = left * ratio + (availableWidth * ratio - physicalDiameter) / 2
  return {
    diameter,
    scale: physicalDiameter / grid,
    offsetX: (Math.round(origin) - origin) / ratio,
    offsetY: (Math.round(top * ratio) - top * ratio) / ratio,
  }
}
