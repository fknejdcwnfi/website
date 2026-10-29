import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { fitPixelViewport, type PixelViewport } from '../presentation/pixelViewport'

type Props = { children: ReactNode; logicalSize: number }

/** Layout-only pixel alignment. No animation frame, artwork or face is rescaled in the rig. */
export default function PortraitViewport({ children, logicalSize }: Props) {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<PixelViewport | null>(null)

  useLayoutEffect(() => {
    const space = spaceRef.current
    if (!space) return
    let disposed = false
    let queuedFrame = 0
    let resolution: MediaQueryList | undefined
    const measure = (): void => {
      if (disposed) return
      const box = space.getBoundingClientRect()
      if (!box.width) return
      const next = fitPixelViewport(box.width, box.left, box.top, logicalSize, window.devicePixelRatio)
      setFrame((previous) => previous && (Object.keys(next) as (keyof PixelViewport)[])
        .every((key) => Math.abs(previous[key] - next[key]) < 0.0001) ? previous : next)
    }
    const schedule = (): void => {
      if (disposed) return
      cancelAnimationFrame(queuedFrame)
      queuedFrame = requestAnimationFrame(measure)
    }
    const watchResolution = (): void => {
      resolution?.removeEventListener('change', onResolution)
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      resolution.addEventListener('change', onResolution)
    }
    const onResolution = (): void => { watchResolution(); schedule() }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(space)
    window.addEventListener('resize', schedule)
    watchResolution()
    measure()
    void document.fonts?.ready.then(schedule)
    return () => {
      disposed = true
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
      resolution?.removeEventListener('change', onResolution)
      cancelAnimationFrame(queuedFrame)
    }
  }, [logicalSize])

  const style = frame ? {
    '--portrait-diameter': `${frame.diameter}px`,
    '--portrait-offset-x': `${frame.offsetX}px`,
    '--portrait-offset-y': `${frame.offsetY}px`,
  } as CSSProperties : undefined

  return (
    <div className="portrait-viewport" ref={spaceRef} data-pixel-grid={logicalSize} data-pixel-scale={frame?.scale}>
      <div className="portrait-viewport__art" style={style}>{children}</div>
    </div>
  )
}
