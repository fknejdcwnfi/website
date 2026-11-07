/** The same small decorative navigation glyphs are used in React and static HTML. */
const navigationIconPaths: Record<string, string> = {
  '#home': 'M1 7h2V5h2V3h2V1h2v2h2v2h2v2h2v2h-2v6H9v-5H7v5H3V9H1V7z',
  '#about': 'M6 1h4v1h2v4h-2v1H6V6H4V2h2V1zM4 9h8v1h2v5H2v-5h2V9z',
  '#work': 'M7 0h2v1h3v1h3v1h1v10h-1v1h-3v1H9v1H7v-1H4v-1H1v-1H0V3h1V2h3V1h3V0zm1 2L3 4l5 2 5-2-5-2zM2 6v6l5 2V8L2 6zm7 2v6l5-2V6L9 8z',
  '#interests': 'M7 0h2v4h1v2h2v1h4v2h-4v1h-2v2H9v4H7v-4H6v-2H4V9H0V7h4V6h2V4h1V0zm5 0h2v2h2v2h-2V2h-2V0zM1 12h2v2h2v2H3v-2H1v-2z',
  '#games': 'M3 4h10v1h2v7h-1v1h-3v-2H5v2H2v-1H1V5h2V4zm1 2v2H2v1h2v2h1V9h2V8H5V6H4zm6 1v2h2V7h-2zm2 2v2h2V9h-2z',
  '#contact': 'M11 0h3v1h2v3h-2v1h-3V4H9V3H7v1H5v2H3v4h2v2h2v1h2v-1h2v-1h3v1h2v3h-2v1h-3v-1H9v-1H7v-1H5v-1H3v-1H1V9H0V6h1V4h2V3h2V2h2V1h4V0z',
}

export const getNavigationIconPath = (href: string): string => navigationIconPaths[href] ?? navigationIconPaths['#interests']!

export const renderNavigationIcon = (href: string): string => `<svg class="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${getNavigationIconPath(href)}"></path></svg>`
