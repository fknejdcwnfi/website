import { pixelIconPaths, type PixelIconName } from '../content/pixelIcons'

/** Tiny, crisp UI glyphs; artwork and animation never depend on these decorations. */
export default function PixelIcon({ name }: { name: PixelIconName }) {
  return <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path fillRule="evenodd" d={pixelIconPaths[name]} /></svg>
}
