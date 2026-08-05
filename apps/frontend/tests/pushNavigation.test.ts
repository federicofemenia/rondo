import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePushDestination } from '../src/pushNavigation';

type MessageListener = (event: { data: unknown }) => void;

function fakeServiceWorkerContainer() {
  const listeners: MessageListener[] = [];
  return {
    addEventListener: (type: string, listener: MessageListener) => {
      if (type === 'message') {
        listeners.push(listener);
      }
    },
    removeEventListener: vi.fn(),
    dispatchMessage(data: unknown): void {
      listeners.forEach((listener) => listener({ data }));
    },
  };
}

function setUrl(path: string): void {
  window.history.replaceState(null, '', path);
}

describe('parsePushDestination', () => {
  it('parses invitations with a valid invitationId', () => {
    expect(parsePushDestination('?open=invitations&invitationId=550e8400-e29b-41d4-a716-446655440000')).toEqual({
      type: 'INVITATIONS',
      invitationId: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('parses invitations with no invitationId at all', () => {
    expect(parsePushDestination('?open=invitations')).toEqual({ type: 'INVITATIONS', invitationId: undefined });
  });

  it('drops an invitationId that is not a valid UUID, keeping the destination', () => {
    expect(parsePushDestination('?open=invitations&invitationId=not-a-uuid')).toEqual({ type: 'INVITATIONS', invitationId: undefined });
  });

  it('parses match-summary/match-players/match-chat/match-ratings with a valid matchId', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';
    expect(parsePushDestination(`?open=match-summary&matchId=${matchId}`)).toEqual({ type: 'MATCH_SUMMARY', matchId });
    expect(parsePushDestination(`?open=match-players&matchId=${matchId}`)).toEqual({ type: 'MATCH_PLAYERS', matchId });
    expect(parsePushDestination(`?open=match-chat&matchId=${matchId}`)).toEqual({ type: 'MATCH_CHAT', matchId });
    expect(parsePushDestination(`?open=match-ratings&matchId=${matchId}`)).toEqual({ type: 'MATCH_RATINGS', matchId });
  });

  it('rejects match destinations with a missing or invalid matchId', () => {
    expect(parsePushDestination('?open=match-summary')).toBeNull();
    expect(parsePushDestination('?open=match-summary&matchId=not-a-uuid')).toBeNull();
    expect(parsePushDestination('?open=match-summary&matchId=<script>alert(1)</script>')).toBeNull();
  });

  it('rejects the retired my-ratings destination (RATING_RECEIVED now opens the match Jugadores tab instead)', () => {
    expect(parsePushDestination('?open=my-ratings')).toBeNull();
  });

  it('returns null for an unknown or missing open value', () => {
    expect(parsePushDestination('?open=something-unexpected')).toBeNull();
    expect(parsePushDestination('')).toBeNull();
    expect(parsePushDestination('?foo=bar')).toBeNull();
  });
});

describe('pushNavigation module store', () => {
  let fakeSw: ReturnType<typeof fakeServiceWorkerContainer>;

  beforeEach(() => {
    vi.resetModules();
    fakeSw = fakeServiceWorkerContainer();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: fakeSw });
  });

  afterEach(() => {
    setUrl('/');
  });

  it('seeds the initial snapshot from window.location.search at import time (cold start)', async () => {
    setUrl('/?open=match-ratings&matchId=550e8400-e29b-41d4-a716-446655440000');
    const mod = await import('../src/pushNavigation');

    expect(mod.getPushNavigationSnapshot().destination).toEqual({ type: 'MATCH_RATINGS', matchId: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('has no pending destination when the app opens with a clean URL', async () => {
    setUrl('/');
    const mod = await import('../src/pushNavigation');

    expect(mod.getPushNavigationSnapshot().destination).toBeNull();
  });

  it('updates the snapshot and notifies subscribers when the service worker posts OPEN_PUSH_DESTINATION', async () => {
    setUrl('/');
    const mod = await import('../src/pushNavigation');
    const listener = vi.fn();
    mod.subscribeToPushNavigation(listener);

    fakeSw.dispatchMessage({ type: 'OPEN_PUSH_DESTINATION', url: '/?open=match-chat&matchId=550e8400-e29b-41d4-a716-446655440000' });

    expect(listener).toHaveBeenCalled();
    expect(mod.getPushNavigationSnapshot().destination).toEqual({ type: 'MATCH_CHAT', matchId: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('ignores a service-worker message of an unrelated type', async () => {
    setUrl('/');
    const mod = await import('../src/pushNavigation');
    const listener = vi.fn();
    mod.subscribeToPushNavigation(listener);

    fakeSw.dispatchMessage({ type: 'SKIP_WAITING' });

    expect(listener).not.toHaveBeenCalled();
    expect(mod.getPushNavigationSnapshot().destination).toBeNull();
  });

  it('ignores a service-worker message whose url does not parse into a known destination', async () => {
    setUrl('/');
    const mod = await import('../src/pushNavigation');
    const listener = vi.fn();
    mod.subscribeToPushNavigation(listener);

    fakeSw.dispatchMessage({ type: 'OPEN_PUSH_DESTINATION', url: '/?open=nonsense' });

    expect(listener).not.toHaveBeenCalled();
    expect(mod.getPushNavigationSnapshot().destination).toBeNull();
  });

  it('clearPendingPushDestination resets the snapshot and strips the deep-link params from the URL, keeping unrelated ones', async () => {
    setUrl('/?utm_source=test&open=match-summary&matchId=550e8400-e29b-41d4-a716-446655440000#anchor');
    const mod = await import('../src/pushNavigation');
    expect(mod.getPushNavigationSnapshot().destination).not.toBeNull();

    mod.clearPendingPushDestination();

    expect(mod.getPushNavigationSnapshot().destination).toBeNull();
    expect(window.location.search).toBe('?utm_source=test');
    expect(window.location.hash).toBe('#anchor');
  });

  it('clearPushDestinationFromUrl is a no-op when there is nothing to clear', async () => {
    setUrl('/?utm_source=test');
    const mod = await import('../src/pushNavigation');

    mod.clearPushDestinationFromUrl();

    expect(window.location.search).toBe('?utm_source=test');
  });
});
