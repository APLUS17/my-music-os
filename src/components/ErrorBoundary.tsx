"use client";

import React from 'react';

interface Props {
  children: React.ReactNode;
  featureName?: string;
  compact?: boolean;
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
    console.error(`Error in ${this.props.featureName || 'component'}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { featureName, compact } = this.props;
      const featureLabel = featureName || 'This feature';

      if (compact) {
        return (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-main)] text-center gap-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {featureLabel} encountered an error.
            </p>
            <div className="flex gap-2">
              <button
                onClick={this.handleRetry}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] text-black hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center justify-center p-6">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold mb-4">
              {featureName ? `${featureName} Error` : 'Application Error'}
            </h1>
            <p className="text-[var(--text-secondary)] mb-4">
              {featureName
                ? `${featureName} encountered an unexpected error. You can try again or clear the cache if the problem persists.`
                : 'The application encountered an error during startup. This is often due to missing environment variables or corrupted data.'}
            </p>
            <details className="text-left bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-lg p-4 mb-4">
              <summary className="cursor-pointer font-medium mb-2">Error Details</summary>
              <pre className="text-xs overflow-auto max-h-48 text-[var(--text-tertiary)]">
                {this.state.error?.message}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2 rounded-lg font-medium bg-[var(--accent)] text-black hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-6 py-2 rounded-lg font-medium bg-[var(--bg-secondary)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
              >
                Clear Cache & Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
