import { useEffect, useMemo, useRef, useState } from 'react'
import { KEY_POSES } from '../animation/keyPoses'
import { KeyPosePlayer } from '../animation/player'
import type { PlayerSnapshot } from '../animation/player'

type StageOptions = {
  debug: boolean
  frozenPose: number | null
}

/**
 * Debug switches intentionally live in the URL rather than as on-screen UI,
 * because the brief asks for a stage with the character and nothing else.
 *
 *   ?debug=1   show a small state readout
 *   ?pose=1-10 freeze one key pose (useful for visual QA)
 */
const readOptions = (): StageOptions => {
  const params = new URLSearchParams(window.location.search)
  const requested = Number(params.get('pose'))
  const frozenPose =
    Number.isInteger(requested) && requested >= 1 && requested <= KEY_POSES.length
      ? requested
      : null
  return { debug: params.get('debug') === '1', frozenPose }
}

const poseLabel = (index: number): string => String(index).padStart(2, '0')

export default function CharacterStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null)
  const options = useMemo(readOptions, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const player = new KeyPosePlayer(canvas, {
      onSnapshot: options.debug ? setSnapshot : undefined,
    })
    if (options.frozenPose !== null) player.setFrozenPose(options.frozenPose)

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    player.setReducedMotion(motion.matches)
    const onMotionChange = (event: MediaQueryListEvent): void => {
      player.setReducedMotion(event.matches)
    }
    motion.addEventListener('change', onMotionChange)

    return () => {
      motion.removeEventListener('change', onMotionChange)
      player.destroy()
    }
  }, [options.debug, options.frozenPose])

  return (
    <div className="stage-shell">
      <div
        className="stage"
        style={{ backgroundImage: `url("${KEY_POSES[0]!.src}")` }}
      >
        <canvas
          ref={canvasRef}
          className="stage__canvas"
          data-frozen={options.frozenPose ?? 'none'}
          role="img"
          aria-label="貝爾摩德：長髮隨風流動、眨眼後回到原位的角色動畫。"
        />
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
    </div>
  )
}