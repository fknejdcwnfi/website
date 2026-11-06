import { loadSceneAssets } from './loadScene'
import { sampleScene } from './sceneTimeline'
import type { SceneAssets, SceneDefinition, ScenePlayback, ScenePlayerOptions, SceneRenderer, SceneRendererFactory } from './types'

/** A new full-frame player's only shared state is the browser motion preference. */
export class ScenePlayer {
  private readonly context: CanvasRenderingContext2D
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly lifetime = new AbortController()
  private assets: SceneAssets | null = null
  private renderer: SceneRenderer | null = null
  private preparation: AbortController | null = null
  private loadingTimer = 0
  private preparationTimer = 0
  private raf = 0
  private destroyed = false
  private visible = true
  private preparing = false
  private painted = false
  private elapsedMs = 0
  private handoffPending = true
  private lastTime: number | null = null
  private published = ''
  private motionEnabled: boolean
  private readonly inspectionTime: number | null
  private readonly preference = (): void => this.sync()
  private readonly visibility = (): void => this.sync()

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly definition: SceneDefinition,
    private readonly createRenderer: SceneRendererFactory,
    private readonly options: ScenePlayerOptions = {},
  ) {
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('A Canvas 2D context is required for this scene.')
    this.context = context
    this.canvas.width = definition.width
    this.canvas.height = definition.height
    this.context.imageSmoothingEnabled = false
    this.motionEnabled = options.motionEnabled === true
    this.inspectionTime = typeof options.timeMs === 'number' && Number.isFinite(options.timeMs)
      ? Math.max(-120_000, Math.min(120_000, options.timeMs)) : null
    canvas.dataset.scene = 'reference-landscape'
    canvas.dataset.ready = 'false'
    canvas.dataset.painted = 'false'
    canvas.dataset.renderer = 'reference-scene'
    this.motion.addEventListener('change', this.preference)
    document.addEventListener('visibilitychange', this.visibility)
    this.publish('loading')
    this.loadingTimer = window.setTimeout(() => this.fail(), 12_000)
    void loadSceneAssets(definition, this.lifetime.signal).then((assets) => {
      if (this.destroyed) return
      window.clearTimeout(this.loadingTimer)
      this.assets = assets
      this.sync()
    }).catch(() => this.fail())
  }

  private reducesMotion(): boolean { return this.motion.matches && !this.motionEnabled }

  private publish(playback: ScenePlayback): void {
    const reduced = this.reducesMotion()
    this.canvas.dataset.playback = playback
    this.canvas.dataset.painted = String(this.painted)
    this.canvas.dataset.motionPreference = reduced ? 'reduced' : 'enabled'
    const key = `${playback}:${this.painted}:${reduced}`
    if (key === this.published) return
    this.published = key
    this.options.onState?.({ playback, painted: this.painted, reduced })
  }

  private canonical(): void {
    if (!this.assets) return
    this.context.imageSmoothingEnabled = false
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.context.drawImage(this.assets.canonical, 0, 0, this.canvas.width, this.canvas.height)
    this.painted = true
  }

  private prepare(): void {
    if (this.preparing || this.renderer || !this.assets || this.destroyed) return
    this.preparing = true
    const controller = new AbortController()
    this.preparation = controller
    this.preparationTimer = window.setTimeout(() => this.fail(), 20_000)
    this.publish('preparing')
    void Promise.resolve().then(() => {
      if (this.destroyed || controller.signal.aborted) throw new DOMException('Scene preparation was cancelled.', 'AbortError')
      return this.createRenderer(this.assets!, controller.signal)
    }).then((renderer) => {
      if (this.destroyed || controller.signal.aborted) { renderer.destroy?.(); return }
      if (!renderer || typeof renderer.paint !== 'function') throw new Error('Invalid scene renderer.')
      window.clearTimeout(this.preparationTimer)
      this.renderer = renderer
      this.preparing = false
      this.sync()
    }).catch(() => {
      if (this.destroyed || controller.signal.aborted) return
      this.fail()
    })
  }

  private cancelPreparation(): void {
    this.preparation?.abort()
    this.preparation = null
    this.preparing = false
    window.clearTimeout(this.preparationTimer)
  }

  private paint(): boolean {
    try {
      if (this.reducesMotion() || !this.renderer) this.canonical()
      else {
        if (this.handoffPending && this.inspectionTime === null) {
          // The preview and final renderer share one source phase. Read this only
          // when a visible dynamic frame is actually about to replace the preview.
          this.handoffPending = false
          try {
            const initial = this.options.initialElapsedMs?.()
            if (typeof initial === 'number' && Number.isFinite(initial) && initial >= 0 && initial <= Number.MAX_SAFE_INTEGER) {
              this.elapsedMs = initial
            }
          } catch { /* Preview timing is optional; a broken preview cannot stop the scene. */ }
          this.canvas.dataset.initialElapsedMs = String(this.elapsedMs)
        }
        this.renderer.paint(this.context, sampleScene(this.inspectionTime ?? this.elapsedMs))
        this.painted = true
      }
      return true
    } catch { this.fail(); return false }
  }

  private sync(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.lastTime = null
    if (this.destroyed || !this.assets) return
    if (this.reducesMotion() && this.preparing) this.cancelPreparation()
    if (document.hidden || !this.visible) { this.publish('suspended'); return }
    if (this.reducesMotion()) {
      this.canvas.dataset.ready = 'true'
      if (this.paint()) this.publish('static')
      return
    }
    if (!this.renderer) {
      this.canvas.dataset.ready = 'false'
      if (this.preparing) this.publish('preparing')
      // Real canonical pixels replace the external poster before numerical work.
      if (!this.paint()) return
      this.prepare()
      return
    }
    this.canvas.dataset.ready = 'true'
    if (!this.paint()) return
    this.publish(this.inspectionTime === null ? 'looping' : 'static')
    if (this.inspectionTime === null) this.raf = requestAnimationFrame(this.tick)
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed || !this.visible || document.hidden) { this.raf = 0; return }
    if (this.reducesMotion()) { this.sync(); return }
    const delta = this.lastTime === null ? 0 : Math.max(0, now - this.lastTime)
    this.lastTime = now
    this.elapsedMs += delta
    if (!this.paint()) return
    this.raf = requestAnimationFrame(this.tick)
  }

  setViewportVisible(visible: boolean): void {
    if (this.visible === visible || this.destroyed) return
    this.visible = visible
    this.sync()
  }

  setMotionEnabled(enabled: boolean): void {
    if (this.motionEnabled === enabled || this.destroyed) return
    this.motionEnabled = enabled
    this.sync()
  }

  /** Resize only the backing surface; keep the prepared renderer and source phase. */
  setOutputSize(width: number, height: number): void {
    if (this.destroyed) return
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > 4096 || height > 4096 || width * height > 8_388_608 ||
      width * this.definition.height !== height * this.definition.width) {
      throw new RangeError('Invalid scene output dimensions.')
    }
    if (this.canvas.width === width && this.canvas.height === height) return
    this.canvas.width = width
    this.canvas.height = height
    this.context.imageSmoothingEnabled = false
    this.painted = false
    this.sync()
  }

  private release(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.lifetime.abort()
    this.cancelPreparation()
    window.clearTimeout(this.loadingTimer)
    window.clearTimeout(this.preparationTimer)
    this.motion.removeEventListener('change', this.preference)
    document.removeEventListener('visibilitychange', this.visibility)
    const renderer = this.renderer
    this.renderer = null
    try { renderer?.destroy?.() } catch { /* Cleanup cannot hide the static fallback. */ }
  }

  private fail(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.release()
    this.canvas.dataset.ready = 'false'
    this.publish('failed')
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.release()
    this.publish('stopped')
  }
}
