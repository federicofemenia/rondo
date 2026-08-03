export type RetryOptions = {
  /** Total number of attempts, including the first one. */
  attempts: number;
  /** Delay before the 2nd attempt; doubles after each further failure. */
  baseDelayMs: number;
  /** Checked before each attempt and each wait; stops retrying once true. */
  isCancelled?: () => boolean;
};

/**
 * Limited, cancelable retry with exponential backoff — used to ride out a
 * free-tier backend waking up from sleep without hammering it or retrying
 * forever. Rethrows the last error once attempts are exhausted (or once
 * cancelled).
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    if (options.isCancelled?.()) {
      throw lastError ?? new Error('Cancelled');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts) {
        break;
      }
      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
