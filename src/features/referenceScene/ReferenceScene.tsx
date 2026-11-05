import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ScenePlayer } from './ScenePlayer'
import { useSceneViewport } from './useSceneViewport'
import { attachBootstrapVideo, releaseBootstrapSource } from './bootstrapVideo'
import { presentationAssets } from './presentationAssets'
import Snowfall from './weather/Snowfall'
import type { SceneDefinition, ScenePlayerState, SceneRendererFactory } from './types'

type Props = {
  definition: SceneDefinition
  createRenderer: SceneRendererFactory
  fallbackSrc?: string
  timeMs?: number | null
}

const MOTION_CHOICE = 'vermouth-motion-enabled'
const readMotionChoice = (): boolean => {
  try { return localStorage.getItem(MOTION_CHOICE) === 'true' } catch { return false }
}
const base = `${import.meta.env.BASE_URL}assets/reference-scene/`
const bootSrc = `${base}${presentationAssets.boot.file}?v=${presentationAssets.boot.sha256}`
const scenerySrc = `${base}${presentationAssets.scenery.file}?v=${presentationAssets.scenery.sha256}`

/** A circular portrait within an uncropped landscape, with immediate progressive motion. */
export default function ReferenceScene({ definition, createRenderer, fallbackSrc, timeMs = null }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const bootHost = useRef<HTMLDivElement>(null)
  const bootVideo = useRef<HTMLVideoElement | null>(null)
  const viewport = useSceneViewport(definition.width, definition.height)
  const player = useRef<ScenePlayer | null>(null)
  const [state, setState] = useState<ScenePlayerState>({ playback: 'loading', painted: false, reduced: false })
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [motionEnabled, setMotionEnabled] = useState(readMotionChoice)
  const motionChoice = useRef(motionEnabled)
  motionChoice.current = motionEnabled
  const [attempt, setAttempt] = useState(0)
  const attempts = useRef(0)
  const [slowLoad, setSlowLoad] = useState(false)
  const [upgraded, setUpgraded] = useState(false)
  const [bootReady, setBootReady] = useState(false)
  const motionAllowed = !systemReduced || motionEnabled
  const allowBoot = motionAllowed && timeMs === null && !upgraded

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = (): void => setSystemReduced(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])

  useLayoutEffect(() => {
    const host = bootHost.current
    if (!host) return
    if (!allowBoot) {
      const previous = bootVideo.current ?? window.__vermouthBootVideo
      if (previous?.getAttribute('src')) releaseBootstrapSource(previous)
      setBootReady(false)
      return
    }
    const video = attachBootstrapVideo(host, bootSrc)
    bootVideo.current = video
    let disposed = false, visible = true
    const ready = (): void => { if (!disposed) setBootReady(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) }
    const sync = (): void => {
      if (disposed) return
      if (document.hidden || !visible) video.pause()
      else void video.play().catch(() => { /* Canonical and snowfall remain available if autoplay is denied. */ })
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      sync()
    })
    observer?.observe(host)
    video.addEventListener('loadeddata', ready)
    video.addEventListener('error', ready)
    document.addEventListener('visibilitychange', sync)
    ready()
    sync()
    return () => {
      disposed = true
      observer?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      video.removeEventListener('loadeddata', ready)
      video.removeEventListener('error', ready)
      video.pause()
      video.remove()
      // StrictMode reattaches the same node synchronously. A real unmount frees
      // its network/decoder resources after that reattachment opportunity.
      queueMicrotask(() => { if (!video.isConnected && video.getAttribute('src')) releaseBootstrapSource(video) })
    }
  }, [allowBoot])

  useEffect(() => {
    if (!canvas.current) return
    let disposed = false
    let failed = false
    let retryTimer = 0
    setUpgraded(false)
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
      setState(next)
      if ((next.playback === 'looping' || next.playback === 'static') && next.painted && !next.reduced) setUpgraded(true)
      if (next.playback === 'failed') {
        window.clearTimeout(slowTimer)
        setSlowLoad(false)
        failed = true
        setUpgraded(false)
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
        initialElapsedMs: () => (bootVideo.current?.currentTime ?? 0) * 1000,
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
    <div className="reference-scene" data-playback={state.playback} data-upgraded={upgraded}>
      <div className="reference-scene__stage">
        <img className="reference-scene__scenery" src={scenerySrc}
          width={presentationAssets.scenery.width} height={presentationAssets.scenery.height}
          alt="富士山雪峰、盛開櫻花與夕陽湖面的完整像素風景" decoding="async" fetchPriority="low" />
        <div ref={viewport.spaceRef} className="reference-scene__space"
          data-pixel-grid={`${definition.width}x${definition.height}`}
          data-pixel-scale={viewport.frame?.scale} data-integer-scale={viewport.frame?.integerScale}>
          <div className="reference-scene__viewport" style={viewport.style}>
            <canvas ref={canvas} width={definition.width} height={definition.height} role="img"
              aria-label={definition.description} aria-hidden={showPoster || undefined}
              className="reference-scene__canvas" />
            {showPoster ? <img className="reference-scene__poster" src={fallbackSrc ?? definition.canonical.src}
              alt={definition.description} width={definition.canonical.width} height={definition.canonical.height} /> : null}
            <div ref={bootHost} className="reference-scene__boot-host" hidden={!allowBoot} />
          </div>
        </div>
        <Snowfall enabled={motionAllowed} timeMs={timeMs} />
      </div>
      <div className="reference-scene__status" aria-live="polite">
        {failed ? <p>{bootReady ? '畫面仍在播放，可重試載入完整效果。' : '動態場景暫時無法載入，先顯示靜態畫面。'}{' '}
          <button type="button" onClick={() => { attempts.current = 0; setAttempt(value => value + 1) }}>重試載入</button>
        </p> : slowLoad && !bootReady && (state.playback === 'loading' || state.playback === 'preparing') ? <p>正在載入動態場景…</p> : null}
        {systemReduced && !failed ? <p>{motionEnabled ? '已為這個場景開啟動態。' : '系統已啟用「減少動態」，場景目前靜止。'}{' '}
          <button type="button" onClick={chooseMotion}>{motionEnabled ? '跟隨系統' : '開啟動態'}</button>
        </p> : null}
      </div>
    </div>
  )
}
