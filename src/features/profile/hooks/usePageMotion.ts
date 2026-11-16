import { useEffect, useRef, useState } from 'react'
import { getMediaQuery, listenMediaQuery } from '../../referenceScene/browserSignals'
import { readSceneMotion, SCENE_MOTION_EVENT } from '../../referenceScene/motionPreference'

export type PageMotion = 'running' | 'paused'
const ENTRY_CLASS = 'page-motion-enter'
const ENTRY_ANIMATION = 'pixel-chapter-enter'

/** Cosmetic movement follows the reader choice without controlling the portrait. */
export const usePageMotion = (): { mode: PageMotion } => {
  const [mode, setMode] = useState<PageMotion>('paused')
  const entered = useRef(new WeakSet<Element>())

  useEffect(() => {
    let disposed = false
    let enabled = readSceneMotion()
    const preference = getMediaQuery('(prefers-reduced-motion: reduce)')
    const sync = (): void => {
      if (disposed) return
      // Unknown preferences keep only cosmetic effects still; the portrait uses
      // the owner's separate default-dynamic policy.
      let reduced = true
      try { reduced = preference?.matches ?? true } catch { /* Unreadable cosmetic signals stay still. */ }
      setMode(enabled && !reduced && !document.hidden ? 'running' : 'paused')
    }
    const choiceChanged = (event: Event): void => {
      const choice: unknown = (event as CustomEvent<{ enabled?: unknown }>).detail?.enabled
      if (typeof choice === 'boolean') { enabled = choice; sync() }
    }
    const stopPreference = listenMediaQuery(preference, sync)
    window.addEventListener(SCENE_MOTION_EVENT, choiceChanged)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      disposed = true
      stopPreference()
      window.removeEventListener(SCENE_MOTION_EVENT, choiceChanged)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'running') return
    const root = document.getElementById('top')
    if (!root) return
    const titles = [...root.querySelectorAll<HTMLElement>('main > .personal-section > .personal-section__label')]
    let active = true
    let observer: IntersectionObserver | null = null
    const finish = (event: AnimationEvent): void => {
      if (event.animationName !== ENTRY_ANIMATION || !(event.target instanceof Element)) return
      event.target.classList.remove(ENTRY_CLASS)
    }
    root.addEventListener('animationend', finish)
    try {
      observer = new IntersectionObserver((entries, current) => {
        if (!active) return
        for (const entry of entries) {
          if (!entry.isIntersecting || entered.current.has(entry.target) || !root.contains(entry.target)) continue
          entered.current.add(entry.target)
          entry.target.classList.add(ENTRY_CLASS)
          try { current.unobserve(entry.target) } catch { /* Entries remain bounded by the WeakSet. */ }
        }
      }, { threshold: .15, rootMargin: '0px 0px -6% 0px' })
      titles.forEach(title => observer?.observe(title))
    } catch {
      active = false
      try { observer?.disconnect() } catch { /* Cosmetic observers are optional. */ }
      observer = null
    }
    return () => {
      active = false
      try { observer?.disconnect() } catch { /* Cleanup must keep the whole page usable. */ }
      root.removeEventListener('animationend', finish)
      titles.forEach(title => title.classList.remove(ENTRY_CLASS))
    }
  }, [mode])

  return { mode }
}
