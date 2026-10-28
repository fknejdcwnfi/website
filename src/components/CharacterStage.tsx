import { useEffect, useMemo, useRef, useState } from 'react'
import { KEY_POSES } from '../animation/keyPoses'
import { KeyPosePlayer } from '../animation/player'
import type { PlayerSnapshot } from '../animation/player'
import { VoxelPlayer } from '../animation/voxelPlayer'
import { readStageOptions } from '../animation/stageOptions'

/**
 * Debug switches intentionally live in the URL rather than as on-screen UI,
 * because the brief asks for a stage with the character and nothing else.
 *
 *   ?debug=1   show a small state readout
 *   ?pose=1-10 freeze one key pose (useful for visual QA)
 */
const poseLabel = (index: number): string => String(index).padStart(2, '0')

export default function CharacterStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null)
  const options = useMemo(() => readStageOptions(window.location.search), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (options.style === 'voxel') {
      const player = new VoxelPlayer(canvas, options, options.debug ? setSnapshot : undefined)
      return () => player.destroy()
    }

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
  }, [options])

  return (
    <div className={`stage-shell stage-shell--${options.style}`}>
      <div
        className={`stage stage--${options.style}`}
        style={options.style === 'legacy' ? { backgroundImage: `url("${KEY_POSES[0]!.src}")` } : undefined}
      >
        <canvas
          ref={canvasRef}
          className="stage__canvas"
          data-frozen={options.frozenPose ?? 'none'}
          data-style={options.style}
          role="img"
          aria-label={options.style === 'voxel' ? 'Minecraft 風格像素貝爾摩德：白金長髮、藍眼睛與藍寶石飾物，髮絲隨風、自然眨眼的方塊肖像。' : '貝爾摩德原始關鍵姿態交叉淡入預覽。'}
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
