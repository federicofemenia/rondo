import { useSyncExternalStore } from 'react';
import { clearPendingPushDestination, getPushNavigationSnapshot, subscribeToPushNavigation, type PushDestination } from './pushNavigation';

type UsePushNavigationResult = {
  /** The pending deep-link destination, from either a cold-start URL (?open=...) or a same-tab service-worker message -- null once consumed or if there was never one. */
  destination: PushDestination | null;
  /** Marks the current destination as consumed: clears it from memory and strips it from the URL. Call this once navigation has been attempted, whether it succeeded or not. */
  clear: () => void;
};

/**
 * Reads the module-level pending-destination singleton (pushNavigation.ts)
 * via `useSyncExternalStore`, so App.tsx re-renders the instant a
 * same-tab service-worker message arrives, without polling or a
 * useEffect-based listener of its own.
 */
export function usePushNavigation(): UsePushNavigationResult {
  const snapshot = useSyncExternalStore(subscribeToPushNavigation, getPushNavigationSnapshot, getPushNavigationSnapshot);
  return { destination: snapshot.destination, clear: clearPendingPushDestination };
}
