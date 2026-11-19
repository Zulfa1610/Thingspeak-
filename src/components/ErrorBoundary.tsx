import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      let parsedMessage = this.state.error?.message || 'An unexpected runtime error occurred.';
      try {
        const parsed = JSON.parse(parsedMessage);
        if (parsed && typeof parsed.error === 'string') {
          parsedMessage = `${parsed.error}${parsed.path ? ` (path: ${parsed.path})` : ''}`;
        }
      } catch {
        // Not JSON
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] p-6">
          <div className="max-w-lg w-full rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-[#111827] p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold">Telemetry Interface Error</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-mono break-words">
              {parsedMessage}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                Recover Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
