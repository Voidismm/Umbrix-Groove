import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  onError?: () => void
}

type State = { failed: boolean }

/** Keeps a visualizer crash from wiping the whole shell. */
export class VisualizerErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Visualizer] render crashed', error, info.componentStack)
    this.props.onError?.()
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="center__viz-error" role="alert">
          <p>Visualizer hit a WebGL error and closed.</p>
          <p>Your library is fine — try opening it again.</p>
        </div>
      )
    }
    return this.props.children
  }
}
