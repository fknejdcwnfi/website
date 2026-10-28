import { KEY_POSES, LOOP_MS } from './keyPoses'

export type PlayerSnapshot = {
  /** Loop-local time in milliseconds. */
  timeMs: number
  /** 1-based index of the pose being held. */
  poseIndex: number
  /** 1-based index of the pose being blended into. */
  nextIndex: number
  /** Cross-fade weight of the next pose, 0..1. */
  blend: number
  wind: number
  eyeOpen: number
}

export type PlayerOptions = {
  /** Called at most every ~120 ms while the player runs. */
  onSnapshot?: (snapshot: PlayerSnapshot) => void
}

type Sample = PlayerSnapshot

const MAX_DPR = 2
const MAX_FADE_MS = 140
const SNAPSHOT_INTERVAL_MS = 120

const smoothstep = (value: number): number =>
  value <= 0 ? 0 : value >= 1 ? 1 : value * value * (3 - 2 * value)

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
  }

  /** Render a single still instead of animating. */
  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled
    this.lastSnapshotAt = Number.NEGATIVE_INFINITY
    this.drawAt(performance.now())
  }

  start(): void {
    if (this.running || this.destroyed) return
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

  private sample(timeMs: number): Sample {
    let position = 0
    for (let index = 0; index < KEY_POSES.length; index += 1) {
      const pose = KEY_POSES[index]
      if (pose && pose.timeMs <= timeMs) position = index
    }

    const current = KEY_POSES[position] ?? KEY_POSES[0]!
    const isLast = position === KEY_POSES.length - 1
    const next = isLast ? KEY_POSES[0]! : KEY_POSES[position + 1]!
    const nextTime = isLast ? LOOP_MS : next.timeMs
    const segment = Math.max(1, nextTime - current.timeMs)
    const fade = Math.min(MAX_FADE_MS, segment * 0.55)
    const fadeStart = nextTime - fade
    const blend = timeMs >= fadeStart ? smoothstep((timeMs - fadeStart) / fade) : 0

    return {
      timeMs,
      poseIndex: current.index,
      nextIndex: next.index,
      blend,
      wind: current.wind + (next.wind - current.wind) * blend,
      eyeOpen: current.eyeOpen + (next.eyeOpen - current.eyeOpen) * blend,
    }
  }

  private drawAt(now: number): void {
    if (this.destroyed) return

    const frozen = this.frozenPose
    const still = this.reducedMotion || frozen !== null
    const timeMs = still ? 0 : this.elapsedAt(now)
    const sample = still
      ? this.stillSample(frozen ?? 1)
      : this.sample(timeMs)

    this.paint(sample)
    this.publish(sample, now)
  }

  private stillSample(poseIndex: number): Sample {
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

  private paint(sample: Sample): void {
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

  private publish(sample: Sample, now: number): void {
    if (!this.onSnapshot || now - this.lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return
    this.lastSnapshotAt = now
    this.onSnapshot(sample)
  }
}