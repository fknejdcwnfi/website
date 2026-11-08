import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { fitSceneViewport, type SceneViewport } from './sceneViewport'
import { getMediaQuery, listenMediaQuery, observeResize } from './browserSignals'

/** Size/DPR work runs only on layout changes, independently of scene playback. */
export const useSceneViewport = (sourceWidth: number, sourceHeight: number) => {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<SceneViewport | null>(null)

  useLayoutEffect(() => {
    const space = spaceRef.current
    if (!space) return
    let disposed = false
    let queuedFrame = 0
    let stopResolution = (): void => {}
    const measure = (): void => {
      if (disposed) return
      const box = space.getBoundingClientRect()
      if (!box.width) return
      const next = fitSceneViewport(box.width, box.left, box.top, sourceWidth, sourceHeight, window.devicePixelRatio)
      setFrame(previous => previous && previous.integerScale === next.integerScale &&
        (['diameter', 'scale', 'offsetX', 'offsetY'] as const)
          .every(key => Math.abs(previous[key] - next[key]) < .0001) ? previous : next)
    }
    const schedule = (): void => {
      if (disposed || queuedFrame) return
      queuedFrame = requestAnimationFrame(() => { queuedFrame = 0; measure() })
    }
    const watchResolution = (): void => {
      stopResolution()
      stopResolution = listenMediaQuery(getMediaQuery(`(resolution: ${window.devicePixelRatio}dppx)`), onResolution)
    }
    const onResolution = (): void => { watchResolution(); schedule() }
    const stopObserving = observeResize(space, schedule)
    window.addEventListener('resize', schedule)
    watchResolution()
    measure()
    void document.fonts?.ready.then(schedule)
    return () => {
      disposed = true
      stopObserving()
      window.removeEventListener('resize', schedule)
      stopResolution()
      cancelAnimationFrame(queuedFrame)
    }
  }, [sourceWidth, sourceHeight])

  const style = frame ? {
    '--scene-diameter': `${frame.diameter}px`,
    '--scene-offset-x': `${frame.offsetX}px`,
    '--scene-offset-y': `${frame.offsetY}px`,
  } as CSSProperties : undefined

  return { spaceRef, style, frame }
}
