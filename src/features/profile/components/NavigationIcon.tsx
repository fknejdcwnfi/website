import { getNavigationIconPath } from '../content/navigationIcons'

export default function NavigationIcon({ href }: { href: string }) {
  return <svg className="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path fillRule="evenodd" d={getNavigationIconPath(href)} /></svg>
}
