/** Keep the parser-started video alive while React replaces the static HTML. */
declare global {
  interface Window {
    __vermouthBootVideo?: HTMLVideoElement
    __vermouthBootCleanup?: () => void
  }
}

const releaseParserListeners = (): void => {
  window.__vermouthBootCleanup?.()
  window.__vermouthBootCleanup = undefined
}

export const retainBootstrapVideo = (): void => {
  releaseParserListeners()
  const existing = window.__vermouthBootVideo ?? document.getElementById('vermouth-bootstrap')
  if (!(existing instanceof HTMLVideoElement)) return
  window.__vermouthBootVideo = existing
  existing.remove()
}

export const attachBootstrapVideo = (host: HTMLElement, src: string): HTMLVideoElement => {
  releaseParserListeners()
  const video = window.__vermouthBootVideo ?? document.createElement('video')
  window.__vermouthBootVideo = video
  video.id = 'vermouth-bootstrap'
  video.className = 'reference-scene__boot'
  video.muted = true
  video.defaultMuted = true
  video.autoplay = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  video.setAttribute('aria-hidden', 'true')
  const ready = (): void => { video.dataset.ready = 'true' }
  video.onloadeddata = ready
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ready()
  else delete video.dataset.ready
  // Reusing the exact parser-created node preserves both the request and phase.
  if (video.getAttribute('src') !== src) video.src = src
  host.append(video)
  return video
}

export const releaseBootstrapSource = (video: HTMLVideoElement): void => {
  video.pause()
  video.removeAttribute('src')
  video.load()
  delete video.dataset.ready
}
