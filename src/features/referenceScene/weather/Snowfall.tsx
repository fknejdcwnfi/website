import { useEffect, useRef } from 'react'
import { createSnowPainter } from './snowField'

type Props = { enabled: boolean; timeMs: number | null }

/** Independent weather can move from the first mounted frame, before character assets. */
export default function Snowfall({ enabled, timeMs }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const elapsed = useRef(0)
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const paintSnow = createSnowPainter()
    let disposed = false, visible = true, raf = 0
    let last: number | null = null
    const paint = (): void => {
      context.clearRect(0, 0, element.width, element.height)
      paintSnow(context, timeMs ?? elapsed.current, element.width, element.height)
      element.dataset.elapsedMs = String(timeMs ?? elapsed.current)
    }
    const stop = (): void => { cancelAnimationFrame(raf); raf = 0; last = null }
    const tick = (now: number): void => {
      if (disposed || document.hidden || !visible) { stop(); return }
      const delta = last === null ? 0 : Math.max(0, now - last)
      last = now
      elapsed.current += delta
      paint()
      raf = requestAnimationFrame(tick)
    }
    const sync = (): void => {
      stop()
      if (disposed) return
      if (document.hidden || !visible) { element.dataset.playback = 'suspended'; return }
      paint()
      if (enabled && timeMs === null) {
        element.dataset.playback = 'looping'
        raf = requestAnimationFrame(tick)
      } else element.dataset.playback = 'static'
    }
    const resize = (): void => {
      if (disposed) return
      const box = element.getBoundingClientRect()
      const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      const width = Math.max(1, Math.round(box.width * scale))
      const height = Math.max(1, Math.round(box.height * scale))
      if (element.width !== width || element.height !== height) {
        element.width = width; element.height = height
      }
      paint()
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(element)
    const visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      sync()
    })
    visibility?.observe(element)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('resize', resize)
    resize()
    sync()
    return () => {
      disposed = true
      stop()
      observer?.disconnect()
      visibility?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('resize', resize)
    }
  }, [enabled, timeMs])
  return <canvas ref={canvas} className="reference-scene__snow" width="716" height="534"
    data-weather="snow" aria-hidden="true" />
}
