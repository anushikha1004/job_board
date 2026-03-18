let initialized = false;

type SentryLike = {
  captureException?: (error: unknown, context?: Record<string, unknown>) => void;
};

function getSentryClient(): SentryLike | null {
  if (typeof globalThis === 'undefined') return null;
  const maybeSentry = (globalThis as { Sentry?: SentryLike }).Sentry;
  return maybeSentry || null;
}

export function initObservability(): void {
  if (initialized) return;
  initialized = true;
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) initObservability();
  const sentry = getSentryClient();
  sentry?.captureException?.(error, { extra: context });
}
