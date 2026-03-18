'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { logError } from '@/lib/logger';

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('ui.route_error', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-lg p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-neon-pink" />
          <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
        </div>
        <p className="text-foreground-muted mb-6">
          {error?.message || 'Unexpected application error. Please try again.'}
        </p>
        <button onClick={reset} className="btn-primary w-full">
          Try again
        </button>
      </div>
    </div>
  );
}

