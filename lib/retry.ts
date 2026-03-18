export async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> {
  const retries = options?.retries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 200;
  const shouldRetry = options?.shouldRetry ?? (() => true);

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      const waitMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      attempt += 1;
    }
  }
}

