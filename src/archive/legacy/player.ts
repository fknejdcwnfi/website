import { KEY_POSES, LOOP_MS } from './keyPoses'
import { sampleTimeline } from './timeline'
import type { TimelineSample } from '../../shared/animation/types'

export type PlayerSnapshot = TimelineSample

export type PlayerOptions = {
  /** Called at most every ~120 ms while the player runs. */
  onSnapshot?: (snapshot: PlayerSnapshot) => void
}

const MAX_DPR = 2
const SNAPSHOT_INTERVAL_MS = 120

/**
 * Stage-1 renderer: holds a key pose and cross-fades into the next one near
 * the end of its slot. It is deliberately simple — the key poses are *not*
 * pixel-aligned animation frames, and cross-fading them can ghost. The target
 * architecture in docs/04-architecture.md replaces this with a rigged,
 * layered character.
 */
export class KeyPosePlayer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly images: HTMLImageElement[] = []
  private readonly loaded: boolean[] = []
  private readonly onSnapshot?: (snapshot: PlayerSnapshot) => void

  private running = false
  private destroyed = false
  private rafId = 0
  private clockStart = 0
  private elapsedOffset = 0
  private lastSnapshotAt = Number.NEGATIVE_INFINITY
  private reducedMotion = false
  private frozenPose: number | null = null

  private resizeObserver: ResizeObserver | null = null
  private readonly handleWindowResize = (): void => this.resize()
  private readonly handleVisibility = (): void => {
    if (document.hidden) this.stop()
    else if (this.isStatic()) this.drawAt(performance.now())
    else this.start()
  }

  constructor(canvas: HTMLCanvasElement, options: PlayerOptions = {}) {
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('This browser does not support a 2D canvas context.')
    this.canvas = canvas
    this.ctx = context
    this.onSnapshot = options.onSnapshot

    KEY_POSES.forEach((pose, position) => {
      const image = new Image()
      image.decoding = 'async'
      image.addEventListener(
        'load',
        () => {
          void image
            .decode()
            .catch(() => undefined)
            .finally(() => {
              this.loaded[position] = true
              if (!this.running) this.drawAt(performance.now())
            })
        },
        { once: true },
      )
      image.src = pose.src
      this.images.push(image)
      this.loaded.push(false)
    })

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    window.addEventListener('resize', this.handleWindowResize)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.start()
  }

  /** Freeze on one pose (1-based), or pass null to resume the timeline. */
  setFrozenPose(pose: number | null): void {
    this.frozenPose = pose
    this.lastSnapshotAt = Number.NEGATIVE_INFINITY
    this.drawAt(performance.now())
    if (this.isStatic()) this.stop()
    else this.start()
  }

  /** Render a single still instead of animating. */
  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled
    this.lastSnapshotAt = Number.NEGATIVE_INFINITY
    this.drawAt(performance.now())
    if (this.isStatic()) this.stop()
    else this.start()
  }

  start(): void {
    if (this.running || this.destroyed || this.isStatic()) return
    this.running = true
    this.clockStart = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.rafId)
    if (this.clockStart > 0) {
      const delta = performance.now() - this.clockStart
      // Ignore huge gaps (tab restore, debugger pauses) so the loop resumes
      // roughly where it stopped instead of jumping.
      this.elapsedOffset += Math.min(delta, LOOP_MS)
      this.elapsedOffset %= LOOP_MS
    }
    this.clockStart = 0
  }

  destroy(): void {
    this.destroyed = true
    this.stop()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    window.removeEventListener('resize', this.handleWindowResize)
    document.removeEventListener('visibilitychange', this.handleVisibility)
  }

  private readonly loop = (now: number): void => {
    if (!this.running || this.destroyed) return
    this.drawAt(now)
    this.rafId = requestAnimationFrame(this.loop)
  }

  private elapsedAt(now: number): number {
    if (this.clockStart === 0) return this.elapsedOffset
    return (this.elapsedOffset + (now - this.clockStart)) % LOOP_MS
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.drawAt(performance.now())
    }
  }

  private isStatic(): boolean {
    return this.reducedMotion || this.frozenPose !== null
  }

  private drawAt(now: number): void {
    if (this.destroyed) return

    const frozen = this.frozenPose
    const still = this.isStatic()
    const timeMs = still ? 0 : this.elapsedAt(now)
    const sample = still
      ? this.stillSample(frozen ?? 1)
      : sampleTimeline(KEY_POSES, timeMs, LOOP_MS)

    this.paint(sample)
    this.publish(sample, now)
  }

  private stillSample(poseIndex: number): TimelineSample {
    const pose =
      KEY_POSES.find((candidate) => candidate.index === poseIndex) ?? KEY_POSES[0]!
    return {
      timeMs: 0,
      poseIndex: pose.index,
      nextIndex: pose.index,
      blend: 0,
      wind: pose.wind,
      eyeOpen: pose.eyeOpen,
    }
  }

  private paint(sample: TimelineSample): void {
    const { width, height } = this.canvas
    const side = Math.min(width, height)
    this.ctx.clearRect(0, 0, width, height)

    const currentPosition = sample.poseIndex - 1
    const nextPosition = sample.nextIndex - 1
    const currentImage = this.images[currentPosition]
    const nextImage = this.images[nextPosition]

    if (currentImage && this.loaded[currentPosition]) {
      this.ctx.globalAlpha = 1
      this.ctx.drawImage(currentImage, 0, 0, side, side)
    }

    if (
      sample.blend > 0 &&
      nextImage &&
      this.loaded[nextPosition] &&
      nextPosition !== currentPosition
    ) {
      this.ctx.globalAlpha = sample.blend
      this.ctx.drawImage(nextImage, 0, 0, side, side)
    }

    this.ctx.globalAlpha = 1
  }

  private publish(sample: TimelineSample, now: number): void {
    if (!this.onSnapshot || now - this.lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return
    this.lastSnapshotAt = now
    this.onSnapshot(sample)
  }
}