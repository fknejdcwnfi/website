/** The parser preview uses its own video clock until a prepared atlas takes over. */
export type ScenePreview = Readonly<{
  src: string
  width: number
  height: number
  durationMs: number
}>

declare global {
  interface Window {
    __vermouthPoeticVideo?: HTMLVideoElement
    __vermouthPoeticCleanup?: () => void
  }
}

const clearParserListeners = (): void => {
  window.__vermouthPoeticCleanup?.()
  window.__vermouthPoeticCleanup = undefined
}

/** Detach the same playing node before React replaces the initial document. */
export const retainPoeticBootstrap = (): void => {
  clearParserListeners()
  const video = window.__vermouthPoeticVideo ?? document.getElementById('vermouth-poetic-bootstrap')
  if (!(video instanceof HTMLVideoElement)) return
  window.__vermouthPoeticVideo = video
  video.remove()
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
  host.append(video)
  return video
}

export const playPoeticBootstrap = (video: HTMLVideoElement, src: string): void => {
  if (video.getAttribute('src') !== src) video.src = src
  void video.play().catch(() => { /* The first-frame image remains if autoplay is unavailable. */ })
}

export const releasePoeticBootstrap = (video: HTMLVideoElement): void => {
  video.pause()
  if (video.hasAttribute('src')) {
    video.removeAttribute('src')
    video.load()
  }
  delete video.dataset.ready
}
