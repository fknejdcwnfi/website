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
const poseLabel = (index: number): string => String(index).padStart(2, '0')

export default function CharacterStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [snapshot, setSnapshot] = useState<TimelineSample | null>(null)
  const initialOptions = useMemo(() => readStageOptions(window.location.search), [])
  const [options, setOptions] = useState(initialOptions)
  const portraitRef = useRef<PortraitPlayer | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (options.style === 'portrait') {
      const player = new PortraitPlayer(canvas, options, options.debug ? setSnapshot : undefined, () => setFailed(true))
      portraitRef.current = player
      const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver(([entry]) => player.setViewportVisible(entry?.isIntersecting ?? true)) : null
      observer?.observe(canvas)
      return () => { observer?.disconnect(); player.destroy(); portraitRef.current = null }
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
  }, [options.style, options.pixel])

  useEffect(() => { portraitRef.current?.update(options) }, [options])

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
      {failed ? <p role="status" className="portrait-error">先為你顯示靜態肖像。</p> : null}
    </div>
  )
}
