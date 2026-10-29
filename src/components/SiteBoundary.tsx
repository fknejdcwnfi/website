import { Component } from 'react'
import type { ReactNode } from 'react'

/** The build's trusted, escaped HTML survives an interactive app failure. */
export default class SiteBoundary extends Component<{ children: ReactNode; fallbackHtml: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <div dangerouslySetInnerHTML={{ __html: this.props.fallbackHtml }} />
      : this.props.children
  }
}
