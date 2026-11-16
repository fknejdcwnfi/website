import { useEffect, useState } from 'react'

/** One queued scroll update, with explicit anchor intent preserved until scrolling. */
export const useActiveSection = (navigation: readonly { href: string }[]): string => {
  const [activeSection, setActiveSection] = useState('home')

  useEffect(() => {
    const sections = navigation.map(link => document.getElementById(link.href.slice(1))).filter((section): section is HTMLElement => section !== null)
    let frame = 0
    let requestedSection: { id: string; scrollY: number | null } | null = null
    const update = (): void => {
      frame = 0
      if (requestedSection) {
        // The browser may clamp a short section's anchor at the document bottom.
        // Keep that explicit destination until the visitor scrolls elsewhere.
        requestedSection.scrollY ??= window.scrollY
        if (Math.abs(window.scrollY - requestedSection.scrollY) <= 1) {
          setActiveSection(requestedSection.id)
          return
        }
        requestedSection = null
      }
      const header = document.querySelector('.site-header')?.getBoundingClientRect()
      const marker = Math.max(48, Math.min(window.innerHeight * .3, (header?.bottom ?? 0) + 48))
      let active = sections[0]?.id ?? 'home'
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) active = section.id
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) active = sections[sections.length - 1]?.id ?? active
      setActiveSection(active)
    }
    const schedule = (): void => { if (!frame) frame = window.requestAnimationFrame(update) }
    const requestSection = (href: string): void => {
      const target = document.getElementById(href.slice(1))
      const section = target?.closest('main > section')
      requestedSection = section && sections.includes(section as HTMLElement) ? { id: section.id, scrollY: null } : null
      if (requestedSection) setActiveSection(requestedSection.id)
      schedule()
    }
    const hashChanged = (): void => requestSection(window.location.hash)
    const anchorClicked = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('.personal-site a[href^="#"]') : null
      if (link) requestSection(link.hash)
    }
    const searchNavigated = (event: Event): void => {
      const href: unknown = (event as CustomEvent).detail
      if (typeof href === 'string' && href.startsWith('#')) requestSection(href)
    }
    if (window.location.hash) hashChanged()
    else update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('hashchange', hashChanged)
    window.addEventListener('site:navigate', searchNavigated)
    document.addEventListener('click', anchorClicked)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('hashchange', hashChanged)
      window.removeEventListener('site:navigate', searchNavigated)
      document.removeEventListener('click', anchorClicked)
    }
  }, [])

  return activeSection
}
