import { Component } from 'react'
import type { ReactNode } from 'react'

type Props = { children: ReactNode; fallbackSrc: string }
type State = { failed: boolean }

/** A portrait failure must not take the rest of the personal website with it. */
export default class PortraitBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="portrait-fallback" data-portrait-fallback="true">
        <img
          src={this.props.fallbackSrc}
          width="768"
          height="768"
          alt="Vermouth 像素肖像（靜態備援）"
          style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '1 / 1', imageRendering: 'pixelated' }}
        />
        <p className="portrait-fallback__status" role="status">動態暫時無法載入，先顯示靜態肖像。</p>
      </div>
    )
  }
}
