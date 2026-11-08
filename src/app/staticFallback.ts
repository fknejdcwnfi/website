/** Copy trusted site markup into an inert document fragment, leaving the live preview alone. */
export const snapshotStaticFallback = (root: HTMLElement): string => {
  const template = root.ownerDocument.createElement('template')
  template.innerHTML = root.innerHTML
  for (const video of template.content.querySelectorAll('video')) {
    video.removeAttribute('src')
    video.removeAttribute('autoplay')
    video.removeAttribute('data-ready')
    video.setAttribute('preload', 'none')
    for (const source of video.querySelectorAll('source')) source.removeAttribute('src')
  }
  for (const group of template.content.querySelectorAll<HTMLElement>('.poetic-entry-group')) {
    group.dataset.weather = 'hidden'
    group.dataset.motion = 'paused'
  }
  for (const preview of template.content.querySelectorAll<HTMLElement>('.reference-scene__preview')) {
    preview.dataset.active = 'false'
  }
  return template.innerHTML
}
