import { captureError } from './observability';

type LogLevel = 'info' | 'warn' | 'error';

function formatLog(level: LogLevel, event: string, payload?: Record<string, unknown>) {
  return {
    ts: new Date().toISOString(),
    level,
    event,
    event_id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    ...payload,
  };
}

export function logInfo(event: string, payload?: Record<string, unknown>): void {
  console.info(JSON.stringify(formatLog('info', event, payload)));
}

export function logWarn(event: string, payload?: Record<string, unknown>): void {
  console.warn(JSON.stringify(formatLog('warn', event, payload)));
}

function normalizeError(error: unknown): { name: string; message: string; code: string } {
  if (error instanceof Error) {
    const errWithCode = error as Error & { code?: unknown };
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      code: typeof errWithCode.code === 'string' ? errWithCode.code : 'no-code',
    };
  }

  if (error && typeof error === 'object') {
    const objectError = error as { name?: unknown; message?: unknown; code?: unknown };
    return {
      name: typeof objectError.name === 'string' ? objectError.name : 'Error',
      message: typeof objectError.message === 'string' ? objectError.message : 'Unknown error',
      code: typeof objectError.code === 'string' ? objectError.code : 'no-code',
    };
  }

  return {
    name: 'Error',
    message: String(error || 'Unknown error'),
    code: 'no-code',
  };
}

export const logError = (event: string, error: unknown, payload: Record<string, unknown> = {}) => {
  const cleanError = {
    ...normalizeError(error),
  };

  captureError(error, { event, ...payload });

  console.error(
    JSON.stringify(
      formatLog('error', event, {
        ...payload,
        error: cleanError
      }),
      null,
      2
    )
  );
};
