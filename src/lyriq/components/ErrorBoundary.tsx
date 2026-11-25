import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="min-h-screen bg-[#111110] text-[#FFFEF2] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-[#1C1C1A] border border-[#2E2E2A] rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-neutral-400">
            Songs are saved in this browser as you work, so reloading should bring back your last saved state.
          </p>
          <pre className="text-left text-xs text-neutral-500 bg-black/30 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
