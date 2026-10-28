import type { TimelineSample } from './timeline'
import type { StageOptions } from './stageOptions'
import { drawVoxel, SIZE } from './voxelScene'
import { sampleVoxel } from './voxelTimeline'

/** Fixed logical bitmap; no image decoding, resampling, WebGL or resize allocations. */
export class VoxelPlayer {
  private raf = 0
  private destroyed = false
  private elapsed = 0
  private last = 0
  private paintedAt = -Infinity
  private readonly ctx: CanvasRenderingContext2D
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly visibility = (): void => this.sync()
  private readonly preference = (): void => this.sync()

  constructor(
    canvas: HTMLCanvasElement,
    private readonly options: StageOptions,
    private readonly snapshot?: (value: TimelineSample) => void,
  ) {
    canvas.width = SIZE
    canvas.height = SIZE
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('A Canvas 2D context is required.')
    this.ctx = context
    this.motion.addEventListener('change', this.preference)
    document.addEventListener('visibilitychange', this.visibility)
    this.sync()
  }

  private staticMode(): boolean {
    return this.motion.matches || this.options.frozenPose !== null
  }

  private paint(): void {
    // Explicit pose is a QA override, including when reduced motion is enabled.
    const sample = sampleVoxel(this.motion.matches ? 0 : this.elapsed, this.options.wind, this.options.frozenPose)
    drawVoxel(this.ctx, { ...sample, seed: this.options.seed, theme: this.options.theme })
    this.snapshot?.(sample)
  }

  private sync(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.last = 0
    this.paintedAt = -Infinity
    if (this.destroyed || document.hidden) return
    this.paint()
    if (!this.staticMode()) this.raf = requestAnimationFrame(this.tick)
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed || document.hidden || this.staticMode()) return
    if (this.last !== 0) this.elapsed += Math.min(now - this.last, 100) * this.options.speed
    this.last = now
    if (now - this.paintedAt >= 1000 / 24) {
      this.paint()
      this.paintedAt = Number.isFinite(this.paintedAt)
        ? now - (now - this.paintedAt) % (1000 / 24)
        : now
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.motion.removeEventListener('change', this.preference)
    document.removeEventListener('visibilitychange', this.visibility)
  }
}
