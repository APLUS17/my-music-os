import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center justify-center p-6">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold mb-4">Application Error</h1>
            <p className="text-[var(--text-secondary)] mb-4">
              The application encountered an error during startup. This is often due to missing environment variables or corrupted data.
            </p>
            <details className="text-left bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-lg p-4 mb-4">
              <summary className="cursor-pointer font-medium mb-2">Error Details</summary>
              <pre className="text-xs overflow-auto max-h-48 text-[var(--text-tertiary)]">
                {this.state.error?.message}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-6 py-2 rounded-lg font-medium bg-[var(--accent)] text-black hover:opacity-90 transition-opacity"
            >
              Clear Cache & Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
