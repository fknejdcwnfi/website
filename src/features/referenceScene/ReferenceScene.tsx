import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ScenePlayer } from './ScenePlayer'
import { useSceneViewport } from './useSceneViewport'
import type { SceneDefinition, ScenePlayerState, SceneRendererFactory } from './types'
import { attachPoeticBootstrap, playPoeticBootstrap, releasePoeticBootstrap, type ScenePreview } from '../poeticPixel/bootstrap'

type Props = {
  definition: SceneDefinition
  createRenderer: SceneRendererFactory
  fallbackSrc?: string
  timeMs?: number | null
  preview?: ScenePreview
}

const MOTION_CHOICE = 'vermouth-motion-enabled'
const readMotionChoice = (): boolean => {
  try { return localStorage.getItem(MOTION_CHOICE) === 'true' } catch { return false }
}

/** A borderless circular viewport; the selected renderer owns source pixels and motion. */
export default function ReferenceScene({ definition, createRenderer, fallbackSrc, timeMs = null, preview }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const viewport = useSceneViewport(definition.width, definition.height)
  const player = useRef<ScenePlayer | null>(null)
  const previewHost = useRef<HTMLDivElement>(null)
  const previewVideo = useRef<HTMLVideoElement | null>(null)
  const handoffDone = useRef(false)
  const [state, setState] = useState<ScenePlayerState>({ playback: 'loading', painted: false, reduced: false })
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [motionEnabled, setMotionEnabled] = useState(readMotionChoice)
  const motionChoice = useRef(motionEnabled)
  motionChoice.current = motionEnabled
  const [attempt, setAttempt] = useState(0)
  const attempts = useRef(0)
  const [slowLoad, setSlowLoad] = useState(false)
  const showPreview = Boolean(preview && timeMs === null && (!systemReduced || motionEnabled) && !handoffDone.current)

  useLayoutEffect(() => {
    const host = previewHost.current
    if (!preview || !host) return
    const video = attachPoeticBootstrap(host, preview)
    previewVideo.current = video
    return () => {
      video.pause()
      video.remove()
      if (previewVideo.current === video) previewVideo.current = null
    }
  }, [preview])

  useEffect(() => {
    const video = previewVideo.current
    const host = previewHost.current
    if (!video || !host || !preview) return
    let inViewport = true
    const sync = (): void => {
      if (showPreview && !document.hidden && inViewport) playPoeticBootstrap(video, preview.src)
      else {
        video.pause()
        if (!showPreview) releasePoeticBootstrap(video)
      }
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      inViewport = entry?.isIntersecting ?? true
      sync()
    })
    observer?.observe(host)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      video.pause()
    }
  }, [preview, showPreview])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = (): void => setSystemReduced(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    if (!canvas.current) return
    let disposed = false
    let failed = false
    let retryTimer = 0
    const slowTimer = window.setTimeout(() => { if (!disposed) setSlowLoad(true) }, 2000)
    const restart = (): void => {
      if (disposed || !failed) return
      failed = false
      setAttempt(value => value + 1)
    }
    const online = (): void => {
      if (!failed) return
      attempts.current = 0
      window.clearTimeout(retryTimer)
      restart()
    }
    const onState = (next: ScenePlayerState): void => {
      if (disposed) return
      if (next.playback === 'loading' || next.playback === 'failed') handoffDone.current = false
      if (next.playback === 'looping') handoffDone.current = true
      setState(next)
      if (next.playback === 'failed') {
        window.clearTimeout(slowTimer)
        setSlowLoad(false)
        failed = true
        if (attempts.current < 2) retryTimer = window.setTimeout(restart, [2000, 5000][attempts.current++]!)
      }
      if (next.playback === 'looping' || next.playback === 'static') {
        window.clearTimeout(slowTimer)
        setSlowLoad(false)
        attempts.current = 0
      }
    }
    let instance: ScenePlayer
    try {
      instance = new ScenePlayer(canvas.current, definition, createRenderer, {
        motionEnabled: motionChoice.current, timeMs,
        initialElapsedMs: () => {
          const video = previewVideo.current
          return video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Number.isFinite(video.currentTime)
            ? video.currentTime * 1000 : 0
        },
        onState,
      })
    } catch {
      onState({ playback: 'failed', painted: false, reduced: systemReduced && !motionChoice.current })
      window.addEventListener('online', online)
      return () => {
        disposed = true
        window.clearTimeout(slowTimer)
        window.clearTimeout(retryTimer)
        window.removeEventListener('online', online)
      }
    }
    player.current = instance
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      instance.setViewportVisible(entry?.isIntersecting ?? true)
    })
    observer?.observe(canvas.current)
    window.addEventListener('online', online)
    return () => {
      disposed = true
      observer?.disconnect()
      window.clearTimeout(slowTimer)
      window.clearTimeout(retryTimer)
      window.removeEventListener('online', online)
      instance.destroy()
      if (player.current === instance) player.current = null
    }
  }, [definition, createRenderer, attempt, timeMs])

  useEffect(() => { player.current?.setMotionEnabled(motionEnabled) }, [motionEnabled])

  const chooseMotion = (): void => {
    const next = !motionEnabled
    try { localStorage.setItem(MOTION_CHOICE, String(next)) } catch { /* A local choice does not require storage. */ }
    setMotionEnabled(next)
  }
  const failed = state.playback === 'failed'
  const showPoster = !state.painted || failed

  return (
    <div className="reference-scene" data-playback={state.playback}>
      <div ref={viewport.spaceRef} className="reference-scene__space"
        data-pixel-grid={`${definition.width}x${definition.height}`}
        data-pixel-scale={viewport.frame?.scale} data-integer-scale={viewport.frame?.integerScale}>
        <div className="reference-scene__viewport" style={viewport.style}>
          <canvas ref={canvas} width={definition.width} height={definition.height} role="img"
            aria-label={definition.description} aria-hidden={showPoster || undefined}
            className="reference-scene__canvas" />
          {showPoster ? <img className="reference-scene__poster" src={fallbackSrc ?? definition.canonical.src}
            alt={definition.description} width={definition.canonical.width} height={definition.canonical.height} /> : null}
          {preview ? <div ref={previewHost} className="reference-scene__preview" data-active={showPreview} aria-hidden="true" /> : null}
        </div>
      </div>
      <div className="reference-scene__status" aria-live="polite">
        {failed ? <p>動態場景暫時無法載入，先保留預覽畫面。{' '}
          <button type="button" onClick={() => { attempts.current = 0; setAttempt(value => value + 1) }}>重試載入</button>
        </p> : slowLoad && (state.playback === 'loading' || state.playback === 'preparing') ? <p>正在載入動態場景…</p> : null}
        {systemReduced && !failed ? <p>{motionEnabled ? '已為這個場景開啟動態。' : '系統已啟用「減少動態」，場景目前靜止。'}{' '}
          <button type="button" onClick={chooseMotion}>{motionEnabled ? '跟隨系統' : '開啟動態'}</button>
        </p> : null}
      </div>
    </div>
  )
}
