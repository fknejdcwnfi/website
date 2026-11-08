const noop = (): void => {}

/** Optional browser signals must not prevent the static scene or its cleanup. */
export const getMediaQuery = (query: string): MediaQueryList | null => {
  try { return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null }
  catch { return null }
}

export const listenMediaQuery = (query: MediaQueryList | null, change: () => void): (() => void) => {
  if (!query) return noop
  let active = true
  const listener = (): void => { if (active) change() }
  let remove = noop
  const modern = (): void => { try { query.removeEventListener?.('change', listener) } catch { /* Optional signal. */ } }
  if (typeof query.addEventListener === 'function') {
    try {
      query.addEventListener('change', listener)
      remove = modern
    } catch {
      // A partially successful registration must not survive a failed setup.
      modern()
    }
  }
  if (remove === noop) {
    try {
      query.addListener?.(listener)
      remove = () => { try { query.removeListener?.(listener) } catch { /* Optional signal. */ } }
    } catch {
      try { query.removeListener?.(listener) } catch { /* Optional signal. */ }
    }
  }
  return () => { active = false; const cleanup = remove; remove = noop; cleanup() }
}

type ElementObserver = { observe(target: Element): void; disconnect(): void }
const observeElement = (target: Element, create: (active: () => boolean) => ElementObserver): (() => void) => {
  let active = true
  let observer: ElementObserver | null = null
  const disconnect = (): void => {
    active = false
    const current = observer
    observer = null
    try { current?.disconnect() } catch { /* A failed optional observer cannot block other cleanup. */ }
  }
  try { observer = create(() => active); observer.observe(target) }
  catch { disconnect() }
  return disconnect
}

export const observeIntersection = (target: Element, callback: IntersectionObserverCallback): (() => void) =>
  observeElement(target, active => new IntersectionObserver((entries, observer) => {
    if (active()) callback(entries, observer)
  }))

export const observeResize = (target: Element, callback: ResizeObserverCallback): (() => void) =>
  observeElement(target, active => new ResizeObserver((entries, observer) => {
    if (active()) callback(entries, observer)
  }))
