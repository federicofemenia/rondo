import { useCallback, useEffect, useRef } from 'react';

type UseVisiblePollingOptions = {
  callback: () => void | Promise<void>;
  intervalMs: number;
  enabled?: boolean;
  runImmediately?: boolean;
};

/**
 * Reusable "feels real-time without WebSockets" polling primitive. Runs
 * `callback` on a fixed interval only while the document is visible,
 * refreshes immediately on regaining visibility/focus/connectivity, and
 * stops the interval entirely (not just slows it down) while hidden. A
 * single timer is ever active per hook instance — visibility/focus/online
 * handlers always clear any pending timer before scheduling or firing again,
 * so toggling quickly never creates duplicates. An in-flight guard skips a
 * tick if the previous call hasn't resolved yet, so a slow or waking-up
 * backend never causes overlapping requests.
 */
export function useVisiblePolling({ callback, intervalMs, enabled = true, runImmediately = true }: UseVisiblePollingOptions): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const inFlightRef = useRef(false);

  const runCallback = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      await callbackRef.current();
    } catch {
      // Swallowed here too: polling is a background refresh, never an
      // invasive error surface. Screens handle their own error UI (or stay
      // silent) inside the callback; this just guarantees the next tick
      // still runs regardless of how the previous one ended.
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const stopInterval = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const startInterval = () => {
      if (intervalId !== undefined) {
        return;
      }
      intervalId = setInterval(() => void runCallback(), intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runCallback();
        startInterval();
      } else {
        stopInterval();
      }
    };

    const handleRefreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void runCallback();
      }
    };

    if (document.visibilityState === 'visible') {
      if (runImmediately) {
        void runCallback();
      }
      startInterval();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleRefreshIfVisible);
    window.addEventListener('online', handleRefreshIfVisible);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleRefreshIfVisible);
      window.removeEventListener('online', handleRefreshIfVisible);
    };
  }, [enabled, intervalMs, runImmediately, runCallback]);
}
