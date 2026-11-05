import { loadSceneAssets } from '../referenceScene/loadScene'
import type { SceneRendererFactory, SceneImageSource } from '../referenceScene/types'
import { calmAssets } from './assets'
import { sampleCalmMotion } from './motion'

/** Independent rigid cutouts behind a completely fixed face/body plate. */
export const createCalmRenderer: SceneRendererFactory = async (assets, signal) => {
  const base = `${import.meta.env.BASE_URL}assets/calm-circle/`
  const layers: Record<string, SceneImageSource> = {}
  for (const name of ['plate', 'eyes', 'left-hair', 'right-hair'] as const) {
    const item = calmAssets.assets[name]
    layers[name] = { src: `${base}${item.file}?v=${item.sha256}`, width: item.width, height: item.height }
  }
  // Dynamic layers are not requested for a reduced-motion/static initial view.
  const rig = await loadSceneAssets({ ...assets.definition, layers }, signal)
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  let destroyed = false
  return {
    paint(context, sample) {
      if (destroyed) return
      context.clearRect(0, 0, 716, 534)
      context.imageSmoothingEnabled = false
      if (sample.static) { context.drawImage(assets.canonical, 0, 0); return }
      const motion = sampleCalmMotion(sample.elapsedMs)
      for (const [index, hair] of calmAssets.hair.entries()) {
        context.save()
        context.translate(hair.pivot[0], hair.pivot[1])
        context.rotate(index === 0 ? motion.left : motion.right)
        context.drawImage(rig.layers[hair.name]!, -hair.pivot[0], -hair.pivot[1])
        context.restore()
      }
      // The face, scalp, front curls, neck, shoulders and necklace are never transformed.
      context.drawImage(rig.layers.plate!, 0, 0)
      for (const [x0, y0, x1, y1] of calmAssets.eyeRects) {
        const rows = Math.round((y1 - y0) * (1 - motion.eyeOpen))
        if (rows) context.drawImage(rig.layers.eyes!, x0, y0, x1 - x0, rows, x0, y0, x1 - x0, rows)
      }
      context.canvas.dataset.motionKind = 'local-rigid-locks'
      context.canvas.dataset.elapsedMs = String(sample.elapsedMs)
      context.canvas.dataset.eyeOpen = String(motion.eyeOpen)
      context.canvas.dataset.hairAngles = `${motion.left},${motion.right}`
    },
    destroy() { destroyed = true },
  }
}
