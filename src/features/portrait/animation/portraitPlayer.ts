import type { TimelineSample } from '../../../shared/animation/types'
import type { StageOptions } from './stageOptions'
import { portraitHeight } from '../renderer/portraitAsset'
import { loadBakedMaterials } from '../renderer/bakedMaterials'
import { PortraitRig } from '../renderer/portraitRig'
import { BLINK_CYCLE_MS, BLINK_DURATION_MS, createMotionTable, LOOP_MS, sampleBlinkProgress, samplePortrait } from './portraitTimeline'

// Retain one MediaQueryList for the module lifetime across React strict-mode mounts.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export class PortraitPlayer {
  private raf = 0
  private destroyed = false
  private viewportVisible = true
  private elapsed = 0
  private last: number | null = null
  private manualBlink: number | null = null
  private lastSnapshot = -Infinity
  private preparation = 0
  private preparedKey: string | null = null
  private rig: PortraitRig | null = null
  private readonly ctx: CanvasRenderingContext2D
  private readonly motion = reducedMotion
  private table: Float32Array[]
  private readonly visibility = (): void => this.sync()
  private readonly preference = (): void => {
    if (this.rig) void this.prepareRig().catch(() => this.fail())
    else this.sync()
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private options: StageOptions,
    private readonly snapshot?: (value: TimelineSample) => void,
    private readonly onError?: () => void,
    private readonly onFirstPaint?: () => void,
    private motionEnabled = false,
  ) {
    canvas.width = options.pixel
    canvas.height = portraitHeight(options.pixel)
    canvas.dataset.ready = 'false'
    canvas.dataset.painted = 'false'
    canvas.dataset.playback = 'loading'
    canvas.dataset.loopDuration = String(LOOP_MS)
    canvas.dataset.blinkCycleDuration = String(BLINK_CYCLE_MS)
    canvas.dataset.renderer = 'layered-arc-mesh'
    canvas.dataset.physicsHz = '240'
    canvas.dataset.physicsCacheHz = '120'
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('A Canvas 2D context is required.')
    this.ctx = context
    this.ctx.imageSmoothingEnabled = false
    this.table = createMotionTable(options)
    this.motion.addEventListener('change', this.preference)
    document.addEventListener('visibilitychange', this.visibility)
    void loadBakedMaterials(`${import.meta.env.BASE_URL}assets/portrait-rig/`, options.pixel)
      .then((materials) => {
        if (this.destroyed) return
        this.rig = new PortraitRig(materials)
        return this.prepareRig()
      }).catch(() => this.fail())
  }

  private async prepareRig(): Promise<void> {
    const rig = this.rig
    if (!rig || this.destroyed) return
    const generation = ++this.preparation
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.last = null
    this.canvas.dataset.ready = 'false'
    this.canvas.dataset.playback = 'preparing'
    if (this.canonicalMode()) {
      this.canvas.dataset.ready = 'true'
      this.sync()
      return
    }
    const key = this.physicsKey()
    try { await rig.prepare(this.options) }
    catch (error) {
      if (this.destroyed || generation !== this.preparation) return
      throw error
    }
    if (this.destroyed || generation !== this.preparation) return
    this.preparedKey = key
    this.canvas.dataset.ready = 'true'
    this.sync()
  }

  private fail(): void {
    if (this.destroyed) return
    this.canvas.dataset.ready = 'false'
    this.destroy()
    this.canvas.dataset.playback = 'failed'
    this.onError?.()
  }

  private renderSafely(): boolean {
    try {
      this.paint()
      return true
    } catch {
      this.fail()
      return false
    }
  }

  private reducesMotion(): boolean { return this.motion.matches && !this.motionEnabled }

  /** An explicit visitor choice can enable this portrait while the OS stays reduced. */
  setMotionEnabled(enabled: boolean): void {
    if (this.motionEnabled === enabled || this.destroyed) return
    this.motionEnabled = enabled
    this.preference()
  }

  blink(): void {
    if (this.reducesMotion() || this.options.frozenPose !== null || this.options.timeMs !== null) return
    this.manualBlink = 0
    this.sync()
  }

  update(options: StageOptions): void {
    const physicsChanged = (['direction', 'gust', 'stiffness', 'damping'] as const).some((key) =>
      this.options[key] !== options[key])
    if (physicsChanged) this.table = createMotionTable(options)
    this.options = options
    if (physicsChanged && this.rig) {
      void this.prepareRig().catch(() => this.fail())
      return
    }
    this.sync()
  }

  setViewportVisible(visible: boolean): void {
    if (this.viewportVisible === visible) return
    this.viewportVisible = visible
    this.sync()
  }

  private staticMode(): boolean {
    return this.reducesMotion() || this.options.frozenPose !== null || this.options.paused || this.options.timeMs !== null
  }

  private canonicalMode(): boolean {
    return this.reducesMotion() || this.options.frozenPose === 1 || this.options.frozenPose === 10
      || this.options.wind === 0 || this.options.direction === 0
  }

  private physicsKey(): string {
    const { direction, gust, stiffness, damping } = this.options
    return JSON.stringify([direction, gust, stiffness, damping])
  }

  private active(): boolean {
    return !this.staticMode() || (this.manualBlink !== null && !this.reducesMotion())
  }

  private paint(): void {
    const sample = samplePortrait(this.options.timeMs ?? (this.reducesMotion() ? 0 : this.elapsed), this.options.wind, this.options.frozenPose)
    if (this.manualBlink !== null) {
      sample.eyeOpen = sampleBlinkProgress(this.manualBlink)
    }
    const canonicalRest = this.canonicalMode()
    this.rig?.paint(this.ctx, this.table, sample.timeMs, canonicalRest ? 0 : this.options.wind, sample.eyeOpen)
    const firstPaint = this.canvas.dataset.painted !== 'true'
    this.canvas.dataset.painted = 'true'
    if (firstPaint) this.onFirstPaint?.()
    if (this.elapsed - this.lastSnapshot >= 80 || this.staticMode()) {
      this.snapshot?.(sample)
      this.lastSnapshot = this.elapsed
    }
  }

  private sync(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.last = null
    if (this.destroyed || !this.rig || this.canvas.dataset.ready !== 'true') return
    if (!this.canonicalMode() && this.preparedKey !== this.physicsKey()) {
      void this.prepareRig().catch(() => this.fail())
      return
    }
    if (document.hidden || !this.viewportVisible) {
      this.canvas.dataset.playback = 'suspended'
      return
    }
    if (this.reducesMotion()) this.manualBlink = null
    this.canvas.dataset.playback = this.staticMode() ? 'static' : 'looping'
    if (!this.renderSafely()) return
    if (this.active()) this.raf = requestAnimationFrame(this.tick)
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed || document.hidden || !this.viewportVisible) return
    if (!this.active()) {
      // A media preference may update between the queued frame and its event.
      if (this.reducesMotion()) this.manualBlink = null
      this.canvas.dataset.playback = 'static'
      if (!this.renderSafely()) return
      this.raf = 0
      return
    }
    const delta = this.last === null ? 0 : Math.min(now - this.last, 100)
    this.last = now
    if (!this.staticMode()) this.elapsed += delta * this.options.speed
    if (this.manualBlink !== null) {
      this.manualBlink += delta
      if (this.manualBlink >= BLINK_DURATION_MS) this.manualBlink = null
    }
    if (!this.renderSafely()) return
    if (this.active()) this.raf = requestAnimationFrame(this.tick)
  }

  destroy(): void {
    this.destroyed = true
    this.preparation += 1
    this.rig?.destroy()
    this.canvas.dataset.playback = 'stopped'
    cancelAnimationFrame(this.raf)
    this.motion.removeEventListener('change', this.preference)
    document.removeEventListener('visibilitychange', this.visibility)
  }
}
