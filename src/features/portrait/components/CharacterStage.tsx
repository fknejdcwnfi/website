import { useEffect, useMemo, useRef, useState } from 'react'
import type { TimelineSample } from '../../../shared/animation/types'
import { readStageOptions } from '../animation/stageOptions'
import { PortraitPlayer } from '../animation/portraitPlayer'
import PortraitControls from './PortraitControls'

/**
 * Debug switches intentionally live in the URL rather than as on-screen UI,
 * so the natural character remains a quiet, continuously looping illustration.
 *
 *   ?debug=1   show a small state readout
 *   ?pose=1-10 freeze one key pose (useful for visual QA)
 */
const MOTION_CHOICE_KEY = 'vermouth-motion-enabled'
const readMotionChoice = (): boolean => {
  try { return localStorage.getItem(MOTION_CHOICE_KEY) === 'true' } catch { return false }
}

const poseLabel = (index: number): string => String(index).padStart(2, '0')

export default function CharacterStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [snapshot, setSnapshot] = useState<TimelineSample | null>(null)
  const initialOptions = useMemo(() => readStageOptions(window.location.search), [])
  const [options, setOptions] = useState(initialOptions)
  const portraitRef = useRef<PortraitPlayer | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(false)
  const retryAttempts = useRef(0)
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [motionEnabled, setMotionEnabled] = useState(readMotionChoice)
  const motionChoiceRef = useRef(motionEnabled)
  motionChoiceRef.current = motionEnabled

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = (): void => setSystemReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  const chooseMotion = (enabled: boolean): void => {
    try { localStorage.setItem(MOTION_CHOICE_KEY, String(enabled)) } catch { /* Storage is optional. */ }
    setMotionEnabled(enabled)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (options.style === 'portrait') {
      let cancelled = false
      let waitingForRecovery = false
      let retryTimer: number | undefined
      const loadingTimer = window.setTimeout(() => setLoading(true), 1500)
      const restart = (): void => {
        if (cancelled || !waitingForRecovery) return
        waitingForRecovery = false
        setRetry((value) => value + 1)
      }
      const onOnline = (): void => {
        if (!waitingForRecovery) return
        retryAttempts.current = 0
        if (retryTimer !== undefined) window.clearTimeout(retryTimer)
        restart()
      }
      const player = new PortraitPlayer(canvas, options, options.debug ? setSnapshot : undefined, () => {
        if (cancelled) return
        window.clearTimeout(loadingTimer)
        setLoading(false)
        setFailed(true)
        waitingForRecovery = true
        if (retryAttempts.current < 2) {
          const delay = [2_000, 5_000][retryAttempts.current++]!
          retryTimer = window.setTimeout(restart, delay)
        }
      }, () => {
        if (cancelled) return
        window.clearTimeout(loadingTimer)
        retryAttempts.current = 0
        setLoading(false)
        setFailed(false)
      }, motionChoiceRef.current)
      portraitRef.current = player
      window.addEventListener('online', onOnline)
      const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver(([entry]) => player.setViewportVisible(entry?.isIntersecting ?? true)) : null
      observer?.observe(canvas)
      return () => {
        cancelled = true
        window.clearTimeout(loadingTimer)
        if (retryTimer !== undefined) window.clearTimeout(retryTimer)
        window.removeEventListener('online', onOnline)
        observer?.disconnect(); player.destroy(); portraitRef.current = null
      }
    }

    // Archived renderers stay outside the homepage's loaded module graph.
    // A strict-mode cleanup can run while an import is still in flight.
    let cancelled = false
    let dispose: (() => void) | undefined
    const startArchive = async (): Promise<void> => {
      if (options.style === 'voxel') {
        const { VoxelPlayer } = await import('../../../archive/voxel/voxelPlayer')
        if (cancelled) return
        const player = new VoxelPlayer(canvas, options, options.debug ? setSnapshot : undefined)
        dispose = () => player.destroy()
        return
      }

      const { KeyPosePlayer } = await import('../../../archive/legacy/player')
      if (cancelled) return
      const player = new KeyPosePlayer(canvas, {
        onSnapshot: options.debug ? setSnapshot : undefined,
      })
      dispose = () => player.destroy()
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
      const onMotionChange = (event: MediaQueryListEvent): void => {
        player.setReducedMotion(event.matches)
      }
      motion.addEventListener('change', onMotionChange)
      dispose = () => {
        motion.removeEventListener('change', onMotionChange)
        player.destroy()
      }
      if (options.frozenPose !== null) player.setFrozenPose(options.frozenPose)
      player.setReducedMotion(motion.matches)
    }
    void startArchive().catch(() => {
      if (cancelled) return
      dispose?.()
      dispose = undefined
      canvas.dataset.playback = 'failed'
      setFailed(true)
    })
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [options.style, options.pixel, retry])

  useEffect(() => { portraitRef.current?.update(options) }, [options])
  useEffect(() => { portraitRef.current?.setMotionEnabled(motionEnabled) }, [motionEnabled])

  return (
    <div className={`stage-shell stage-shell--${options.style}`}>
      <div
        className={`stage stage--${options.style}`}
        style={options.style === 'legacy' ? { backgroundImage: `url("${import.meta.env.BASE_URL}assets/frames/frame_01.webp")` }
          : options.style === 'portrait' ? { backgroundImage: `url("${import.meta.env.BASE_URL}assets/portrait-natural/base${options.pixel === 256 ? '' : `-${options.pixel}`}.png")` } : undefined}
      >
        <canvas
          ref={canvasRef}
          className="stage__canvas"
          data-frozen={options.frozenPose ?? 'none'}
          data-style={options.style}
          data-autoplay={options.style === 'portrait' ? 'continuous' : undefined}
          role="img"
          aria-hidden={failed || undefined}
          aria-label={options.style === 'portrait' ? '貝爾摩德的二維像素動態肖像：冰藍眼睛、尖下巴、神秘微笑、白金捲髮與藍寶石飾物，微風吹動髮絲並自然眨眼。'
            : options.style === 'voxel' ? '封存的 Minecraft 方塊貝爾摩德示範。' : '貝爾摩德原始關鍵姿態交叉淡入預覽。'}
        />
        {failed ? <img className="stage__fallback" src={`${import.meta.env.BASE_URL}portrait-rest.png`}
          alt="Vermouth 的靜態像素肖像，動畫暫時無法載入" width="768" height="768" /> : null}
      </div>

      {options.debug ? (
        <dl className="hud" aria-hidden="true">
          <dt>t</dt>
          <dd>{Math.round(snapshot?.timeMs ?? 0)} ms</dd>
          <dt>pose</dt>
          <dd>
            {poseLabel(snapshot?.poseIndex ?? 1)} → {poseLabel(snapshot?.nextIndex ?? 2)}
          </dd>
          <dt>blend</dt>
          <dd>{(snapshot?.blend ?? 0).toFixed(2)}</dd>
          <dt>wind</dt>
          <dd>{(snapshot?.wind ?? 0).toFixed(2)}</dd>
          <dt>eyes</dt>
          <dd>{(snapshot?.eyeOpen ?? 1).toFixed(2)}</dd>
          <dt>frozen</dt>
          <dd>{options.frozenPose ?? 'none'}</dd>
        </dl>
      ) : null}
      {options.debug && options.style === 'portrait' ? (
        <PortraitControls options={options} change={(patch) => setOptions((current) => ({ ...current, ...patch }))}
          blink={() => portraitRef.current?.blink()} />
      ) : null}
      {systemReduced && options.style === 'portrait' && !failed ? (
        <div className="portrait-motion-notice">
          <p role="status">{motionEnabled ? '已為這個肖像開啟動態。' : '系統已啟用「減少動態」，肖像目前靜止。'}</p>
          <button type="button" onClick={() => chooseMotion(!motionEnabled)}>{motionEnabled ? '跟隨系統' : '開啟動態'}</button>
        </div>
      ) : null}
      {loading && !failed ? <p role="status" className="portrait-error">正在載入動態肖像…</p> : null}
      {failed ? <p role="status" className="portrait-error">動態肖像暫時無法載入，已顯示靜態肖像。{' '}
        <button type="button" onClick={() => { retryAttempts.current = 0; setRetry((value) => value + 1) }}>重試載入</button>
      </p> : null}
    </div>
  )
}
