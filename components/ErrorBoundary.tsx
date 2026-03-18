'use client';

import React, { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { logError } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('ui.error_boundary.caught', error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="glass rounded-lg p-8 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-neon-pink" />
                <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
              </div>
              <p className="text-foreground-muted mb-6">
                {this.state.error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary w-full"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
