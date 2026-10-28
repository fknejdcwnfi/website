import type { TimelineSample } from './timeline'
import type { StageOptions } from './stageOptions'
import { loadImage } from '../character/portraitAsset'
import { PortraitRig } from '../character/portraitRig'
import { createMotionTable, samplePortrait } from './portraitTimeline'

// Retain one MediaQueryList for the module lifetime across React strict-mode mounts.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export class PortraitPlayer {
  private raf = 0
  private destroyed = false
  private elapsed = 0
  private last: number | null = null
  private manualBlink: number | null = null
  private lastSnapshot = -Infinity
  private rig: PortraitRig | null = null
  private readonly ctx: CanvasRenderingContext2D
  private readonly motion = reducedMotion
  private table: Float32Array[]
  private readonly visibility = (): void => this.sync()
  private readonly preference = (): void => this.sync()

  constructor(
    canvas: HTMLCanvasElement,
    private options: StageOptions,
    private readonly snapshot?: (value: TimelineSample) => void,
    onError?: () => void,
  ) {
    canvas.width = canvas.height = options.pixel
    canvas.dataset.ready = 'false'
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('A Canvas 2D context is required.')
    this.ctx = context
    this.ctx.imageSmoothingEnabled = false
    this.table = createMotionTable(options)
    this.motion.addEventListener('change', this.preference)
    document.addEventListener('visibilitychange', this.visibility)
    const suffix = options.pixel === 256 ? '' : `-${options.pixel}`
    const base = `${import.meta.env.BASE_URL}assets/portrait/`
    void Promise.all([loadImage(`${base}base${suffix}.png`), loadImage(`${base}eyelids${suffix}.png`)])
      .then(([open, closed]) => {
        if (this.destroyed) return
        this.rig = new PortraitRig(open, closed, options.pixel)
        canvas.dataset.ready = 'true'
        this.sync()
      }).catch(() => { if (!this.destroyed) onError?.() })
  }

  blink(): void {
    if (this.motion.matches || this.options.frozenPose !== null || this.options.timeMs !== null) return
    this.manualBlink = 0
    this.sync()
  }

  update(options: StageOptions): void {
    if ((['direction', 'gust', 'stiffness', 'damping'] as const).some((key) =>
      this.options[key] !== options[key])) this.table = createMotionTable(options)
    this.options = options
    this.sync()
  }

  private staticMode(): boolean {
    return this.motion.matches || this.options.frozenPose !== null || this.options.paused || this.options.timeMs !== null
  }

  private active(): boolean {
    return !this.staticMode() || (this.manualBlink !== null && !this.motion.matches)
  }

  private paint(): void {
    const sample = samplePortrait(this.options.timeMs ?? (this.motion.matches ? 0 : this.elapsed), this.options.wind, this.options.frozenPose)
    if (this.manualBlink !== null) {
      const t = this.manualBlink
      sample.eyeOpen = t < 110 ? 1 - t / 110 : (t - 110) / 110
    }
    this.rig?.paint(this.ctx, this.table, sample.timeMs, this.options.wind, sample.eyeOpen)
    if (this.elapsed - this.lastSnapshot >= 80 || this.staticMode()) {
      this.snapshot?.(sample)
      this.lastSnapshot = this.elapsed
    }
  }

  private sync(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.last = null
    if (this.destroyed || !this.rig || document.hidden) return
    if (this.motion.matches) this.manualBlink = null
    this.paint()
    if (this.active()) this.raf = requestAnimationFrame(this.tick)
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed || document.hidden) return
    if (!this.active()) {
      // A media preference may update between the queued frame and its event.
      if (this.motion.matches) this.manualBlink = null
      this.paint()
      this.raf = 0
      return
    }
    const delta = this.last === null ? 0 : Math.min(now - this.last, 100)
    this.last = now
    if (!this.staticMode()) this.elapsed += delta * this.options.speed
    if (this.manualBlink !== null) {
      this.manualBlink += delta
      if (this.manualBlink >= 220) this.manualBlink = null
    }
    this.paint()
    if (this.active()) this.raf = requestAnimationFrame(this.tick)
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.motion.removeEventListener('change', this.preference)
    document.removeEventListener('visibilitychange', this.visibility)
  }
}
