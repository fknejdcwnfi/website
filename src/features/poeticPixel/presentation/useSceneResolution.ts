import { useLayoutEffect, useState, type RefObject } from 'react'
import { BASE_SCENE_RESOLUTION, resolveSceneResolution, type SceneResolution } from './resolution'
import { getMediaQuery, listenMediaQuery, observeResize } from '../../referenceScene/browserSignals'

/** Size and DPR reads happen only after layout changes, never in the paint loop. */
export const useSceneResolution = (
  circle: RefObject<HTMLDivElement | null>,
  enabled: boolean,
): SceneResolution => {
  const [resolution, setResolution] = useState<SceneResolution>(BASE_SCENE_RESOLUTION)
  useLayoutEffect(() => {
    if (!enabled) {
      setResolution(previous => previous === BASE_SCENE_RESOLUTION ? previous : BASE_SCENE_RESOLUTION)
      return
    }
    const element = circle.current
    if (!element) return
    let disposed = false
    let scheduled = 0
    let stopDpr = (): void => {}
    const measure = (): void => {
      if (disposed) return
      const width = element.getBoundingClientRect().width
      if (!(width > 0)) return
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      const next = resolveSceneResolution(width, window.devicePixelRatio, memory)
      setResolution(previous => previous.width === next.width && previous.height === next.height ? previous : next)
    }
    const schedule = (): void => {
      if (disposed || scheduled) return
      scheduled = requestAnimationFrame(() => { scheduled = 0; measure() })
    }
    const watchDpr = (): void => {
      stopDpr()
      stopDpr = listenMediaQuery(getMediaQuery(`(resolution: ${window.devicePixelRatio}dppx)`), dprChanged)
    }
    const dprChanged = (): void => { watchDpr(); schedule() }
    const stopObserving = observeResize(element, schedule)
    window.addEventListener('resize', schedule)
    watchDpr()
    measure()
    return () => {
      disposed = true
      stopObserving()
      stopDpr()
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(scheduled)
    }
  }, [circle, enabled])
  return resolution
}
