/**
 * Deep-link destinations a push notification's `url` (see
 * apps/backend/src/modules/push/pushCopy.ts) can carry, parsed from Rondo's
 * own `/?open=...` query-param scheme -- there is no React Router in this
 * app (see App.tsx's `currentView` state machine), so this is the whole
 * mechanism for "a push opens the right screen" (see docs/WEB_PUSH.md).
 */
export type PushDestination =
  | { type: 'INVITATIONS'; invitationId?: string }
  | { type: 'MATCH_SUMMARY'; matchId: string }
  | { type: 'MATCH_PLAYERS'; matchId: string }
  | { type: 'MATCH_CHAT'; matchId: string }
  | { type: 'MATCH_RATINGS'; matchId: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(value: string | null): value is string {
  return value !== null && UUID_PATTERN.test(value);
}

/**
 * Parses the `open`/`matchId`/`invitationId` query params into a typed
 * PushDestination. IDs are only checked for "looks like a UUID" here --
 * this function never trusts the network, so it can't tell whether a match
 * or invitation actually exists or is visible to the current user; that
 * check happens once the destination is resolved against real app data
 * (App.tsx), which is also where a stale/invalid id turns into user-facing
 * feedback rather than a silent no-op.
 */
export function parsePushDestination(search: string): PushDestination | null {
  const params = new URLSearchParams(search);
  const open = params.get('open');

  switch (open) {
    case 'invitations': {
      const invitationId = params.get('invitationId');
      return { type: 'INVITATIONS', invitationId: isValidId(invitationId) ? invitationId : undefined };
    }
    case 'match-summary': {
      const matchId = params.get('matchId');
      return isValidId(matchId) ? { type: 'MATCH_SUMMARY', matchId } : null;
    }
    case 'match-players': {
      const matchId = params.get('matchId');
      return isValidId(matchId) ? { type: 'MATCH_PLAYERS', matchId } : null;
    }
    case 'match-chat': {
      const matchId = params.get('matchId');
      return isValidId(matchId) ? { type: 'MATCH_CHAT', matchId } : null;
    }
    case 'match-ratings': {
      const matchId = params.get('matchId');
      return isValidId(matchId) ? { type: 'MATCH_RATINGS', matchId } : null;
    }
    default:
      return null;
  }
}

/**
 * Strips open/matchId/invitationId from the current URL via
 * history.replaceState -- no reload, no other query params or hash
 * touched. Runs once a destination has been applied (successfully or not),
 * so refreshing the page never re-applies the same deep link, and a
 * bookmarked/shared URL never carries a stale one.
 */
export function clearPushDestinationFromUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (!url.searchParams.has('open')) {
    return;
  }
  url.searchParams.delete('open');
  url.searchParams.delete('matchId');
  url.searchParams.delete('invitationId');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

type PushNavigationSnapshot = { destination: PushDestination | null };

function readInitialSnapshot(): PushNavigationSnapshot {
  return { destination: typeof window !== 'undefined' ? parsePushDestination(window.location.search) : null };
}

let snapshot: PushNavigationSnapshot = readInitialSnapshot();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Handles the "app already open" half of notificationclick: the service
 * worker focuses the existing window and posts this message instead of
 * calling `client.navigate()` (which would force a full SPA reload just to
 * apply a deep link the app can perfectly well apply in place). See sw.ts.
 */
function handleServiceWorkerMessage(event: MessageEvent): void {
  const data = event.data as { type?: string; url?: string } | undefined;
  if (data?.type !== 'OPEN_PUSH_DESTINATION' || typeof data.url !== 'string') {
    return;
  }
  const destination = parsePushDestination(new URL(data.url, window.location.origin).search);
  if (!destination) {
    return;
  }
  snapshot = { destination };
  emit();
}

/**
 * Registered at module evaluation time, same rationale as installPrompt.ts:
 * a push tap can arrive before any component mounts (or while a totally
 * different screen is showing), so the listener must not depend on any
 * particular component being on screen.
 */
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
}

export function getPushNavigationSnapshot(): PushNavigationSnapshot {
  return snapshot;
}

export function subscribeToPushNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Consumes the pending destination: clears it from memory and from the URL
 * so it can never be applied a second time, whether the caller successfully
 * navigated to it or gave up and fell back to Home.
 */
export function clearPendingPushDestination(): void {
  snapshot = { destination: null };
  clearPushDestinationFromUrl();
  emit();
}
