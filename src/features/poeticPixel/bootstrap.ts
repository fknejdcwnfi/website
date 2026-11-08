/** The parser preview uses its own video clock until a prepared atlas takes over. */
export type ScenePreview = Readonly<{
  src: string
  width: number
  height: number
  durationMs: number
}>

type EntryAnimationPhase = { key: string; time: number; running: boolean }
type EntryPhase = { capturedAt: number; animations: EntryAnimationPhase[] }

declare global {
  interface Window {
    __vermouthPoeticVideo?: HTMLVideoElement
    __vermouthPoeticCleanup?: () => void
    __vermouthPoeticEntry?: HTMLDivElement
    __vermouthPoeticEntryPhase?: EntryPhase
  }
}

/** Tiny first-paint atmosphere: no image, bundle, decoder or network dependency. */
export const renderPoeticEntryAtmosphere = (): string => {
  const snow = Array.from({ length: 40 }, (_, index) => {
    const x = (index * 97 + 19) % 358
    const duration = 12 + index % 9
    const phase = -duration * ((index * .61803398875 + .17) % 1)
    const alpha = x > 126 && x < 234 ? .16 : .45 + (index % 3) * .16
    const shape = index % 5 === 0 ? 'M1 0h1v1h1v1H2v1H1V2H0V1h1z' : 'M0 0h1v1H0z'
    return `<g class="poetic-entry-fall" data-entry-particle="snow-${index}" style="--entry-x:${x}px;--entry-end-x:${x + 36}px;--entry-duration:${duration}s;--entry-phase:${phase.toFixed(3)}s;opacity:${alpha}"><path d="${shape}" fill="${index % 3 ? '#f2f8ff' : '#cee3fb'}"/></g>`
  }).join('')
  const lanes = [62, 94, 116, 236, 262, 286, 76, 103, 222, 250, 274, 90]
  const petals = lanes.map((x, index) => {
    const duration = 18 + index % 8
    const phase = -duration * ((index * .61803398875 + .31) % 1)
    const alpha = x > 100 && x < 235 ? .38 : .88
    return `<g class="poetic-entry-fall poetic-entry-petal" data-entry-particle="petal-${index}" style="--entry-x:${x}px;--entry-end-x:${x + 24 + index % 4 * 5}px;--entry-duration:${duration}s;--entry-phase:${phase.toFixed(3)}s;--entry-tumble:${5 + index % 4}s;opacity:${alpha}"><g class="poetic-entry-tumble" data-entry-particle="petal-spin-${index}"><path d="M2 0h2v1h2v3H5v1H3v1H1V5H0V2h1V1h1z" fill="#f7a4c3"/><path d="M2 1h2v1h1v2H3v1H1V3h1z" fill="#ffd4e3"/><path d="M2 0h1v1H2z" fill="#fff0f6"/></g></g>`
  }).join('')
  return `<svg class="poetic-entry-atmosphere" viewBox="0 0 358 267" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false" data-snow="40" data-petals="12">${snow}${petals}</svg>`
}

const groupFor = (video: HTMLVideoElement): HTMLDivElement | null =>
  video.closest<HTMLDivElement>('.poetic-entry-group') ?? window.__vermouthPoeticEntry ?? null

const captureEntryPhase = (group: HTMLDivElement): void => {
  if (typeof group.getAnimations !== 'function') return
  const animations: EntryAnimationPhase[] = []
  for (const animation of group.getAnimations({ subtree: true })) {
    const target = (animation.effect as KeyframeEffect | null)?.target
    if (!(target instanceof Element) || typeof animation.currentTime !== 'number') continue
    const key = `${target.getAttribute('data-entry-particle')}:${(animation as CSSAnimation).animationName}`
    animations.push({ key, time: animation.currentTime, running: animation.playState === 'running' })
  }
  window.__vermouthPoeticEntryPhase = { capturedAt: performance.now(), animations }
}

const restoreEntryPhase = (group: HTMLDivElement): void => {
  const phase = window.__vermouthPoeticEntryPhase
  if (!phase || typeof group.getAnimations !== 'function') return
  const elapsed = performance.now() - phase.capturedAt
  for (const animation of group.getAnimations({ subtree: true })) {
    const target = (animation.effect as KeyframeEffect | null)?.target
    if (!(target instanceof Element)) continue
    const key = `${target.getAttribute('data-entry-particle')}:${(animation as CSSAnimation).animationName}`
    const previous = phase.animations.find(entry => entry.key === key)
    if (previous) animation.currentTime = previous.time + (previous.running ? elapsed : 0)
  }
  window.__vermouthPoeticEntryPhase = undefined
}

const clearParserListeners = (): void => {
  const cleanup = window.__vermouthPoeticCleanup
  window.__vermouthPoeticCleanup = undefined
  try { cleanup?.() } catch { /* A failed optional parser listener cannot block media cleanup. */ }
}

/** Detach the same playing node before React replaces the initial document. */
export const retainPoeticBootstrap = (): void => {
  clearParserListeners()
  const video = window.__vermouthPoeticVideo ?? document.getElementById('vermouth-poetic-bootstrap')
  if (!(video instanceof HTMLVideoElement)) return
  window.__vermouthPoeticVideo = video
  const group = video.closest<HTMLDivElement>('.poetic-entry-group')
  if (group) {
    captureEntryPhase(group)
    window.__vermouthPoeticEntry = group
    group.remove()
  } else video.remove()
}

export const attachPoeticBootstrap = (host: HTMLElement, preview: ScenePreview): HTMLVideoElement => {
  clearParserListeners()
  const video = window.__vermouthPoeticVideo ?? document.createElement('video')
  window.__vermouthPoeticVideo = video
  video.id = 'vermouth-poetic-bootstrap'
  video.className = 'poetic-scene__boot'
  video.width = preview.width
  video.height = preview.height
  video.muted = true
  video.defaultMuted = true
  video.autoplay = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  video.setAttribute('aria-hidden', 'true')
  video.dataset.src = preview.src
  const ready = (): void => { video.dataset.ready = 'true' }
  video.onloadeddata = ready
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ready()
  else delete video.dataset.ready
  const group = window.__vermouthPoeticEntry ?? document.createElement('div')
  if (!window.__vermouthPoeticEntry) {
    group.id = 'vermouth-poetic-entry'
    group.className = 'poetic-entry-group'
    group.dataset.weather = 'hidden'
    group.dataset.motion = 'paused'
    group.innerHTML = renderPoeticEntryAtmosphere()
    window.__vermouthPoeticEntry = group
  }
  if (video.parentElement !== group) group.prepend(video)
  host.append(group)
  restoreEntryPhase(group)
  return video
}

export const playPoeticBootstrap = (video: HTMLVideoElement, src: string): void => {
  const group = groupFor(video)
  if (group) {
    const params = new URLSearchParams(location.search)
    group.dataset.weather = params.get('atmosphere') === '0' || params.get('snow') === '0' ? 'hidden' : 'visible'
    group.dataset.motion = 'running'
  }
  if (video.getAttribute('src') !== src) video.src = src
  void video.play().catch(() => { /* The first-frame image remains if autoplay is unavailable. */ })
}

export const pausePoeticBootstrap = (video: HTMLVideoElement): void => {
  video.pause()
  const group = groupFor(video)
  if (group) group.dataset.motion = 'paused'
}

/** StrictMode/unmount cleanup keeps the same media node and atmosphere phase. */
export const detachPoeticBootstrap = (video: HTMLVideoElement): void => {
  const group = groupFor(video)
  if (group) {
    captureEntryPhase(group)
    group.remove()
  } else video.remove()
  video.pause()
}

export const releasePoeticBootstrap = (video: HTMLVideoElement, fadeWeather = false): void => {
  video.pause()
  if (video.hasAttribute('src')) {
    video.removeAttribute('src')
    video.load()
  }
  delete video.dataset.ready
  const group = groupFor(video)
  if (!group) return
  if (fadeWeather && group.dataset.weather === 'visible') {
    group.dataset.weather = 'fading'
    window.setTimeout(() => {
      if (group.dataset.weather !== 'fading') return
      group.dataset.weather = 'hidden'
      group.dataset.motion = 'paused'
    }, 180)
  } else if (!fadeWeather || group.dataset.weather !== 'fading') {
    group.dataset.weather = 'hidden'
    group.dataset.motion = 'paused'
  }
}

/** A render failure will not reattach the retained node; release its decoder too. */
export const discardPoeticBootstrap = (): void => {
  clearParserListeners()
  const video = window.__vermouthPoeticVideo
  const group = window.__vermouthPoeticEntry
  try {
    if (video) {
      try { releasePoeticBootstrap(video) } catch { /* Keep the static error fallback available. */ }
      video.onloadeddata = null
      video.remove()
    }
    group?.remove()
  } finally {
    window.__vermouthPoeticVideo = undefined
    window.__vermouthPoeticEntry = undefined
    window.__vermouthPoeticEntryPhase = undefined
  }
}
