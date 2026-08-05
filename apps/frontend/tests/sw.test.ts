import { beforeEach, describe, expect, it, vi } from 'vitest';

const precacheAndRouteMock = vi.fn();
const cleanupOutdatedCachesMock = vi.fn();
const createHandlerBoundToURLMock = vi.fn(() => vi.fn());
const registerRouteMock = vi.fn();

class FakeNavigationRoute {
  handler: unknown;
  options: unknown;
  constructor(handler: unknown, options: unknown) {
    this.handler = handler;
    this.options = options;
  }
}

vi.mock('workbox-precaching', () => ({
  precacheAndRoute: precacheAndRouteMock,
  cleanupOutdatedCaches: cleanupOutdatedCachesMock,
  createHandlerBoundToURL: createHandlerBoundToURLMock,
}));

vi.mock('workbox-routing', () => ({
  registerRoute: registerRouteMock,
  NavigationRoute: FakeNavigationRoute,
}));

type AnyListener = (event: never) => unknown;
const listeners = new Map<string, AnyListener[]>();

function fakeAddEventListener(type: string, listener: AnyListener): void {
  const existing = listeners.get(type) ?? [];
  existing.push(listener);
  listeners.set(type, existing);
}

async function dispatch(type: string, event: Record<string, unknown>): Promise<void> {
  const waited: Promise<unknown>[] = [];
  const eventWithWaitUntil = { ...event, waitUntil: (promise: Promise<unknown>) => waited.push(promise) };
  for (const listener of listeners.get(type) ?? []) {
    await listener(eventWithWaitUntil as never);
  }
  await Promise.all(waited);
}

const showNotificationMock = vi.fn();
const matchAllMock = vi.fn();
const openWindowMock = vi.fn();

function installFakeServiceWorkerScope(): void {
  listeners.clear();
  showNotificationMock.mockReset().mockResolvedValue(undefined);
  matchAllMock.mockReset().mockResolvedValue([]);
  openWindowMock.mockReset().mockResolvedValue(undefined);

  (globalThis as unknown as { self: unknown }).self = {
    location: { origin: 'https://rondo.test' },
    __WB_MANIFEST: [],
    addEventListener: fakeAddEventListener,
    clients: { matchAll: matchAllMock, openWindow: openWindowMock, claim: vi.fn() },
    registration: { showNotification: showNotificationMock },
    skipWaiting: vi.fn(),
  };
}

function fakeWindowClient(url: string) {
  return { url, focus: vi.fn().mockResolvedValue(undefined), postMessage: vi.fn() };
}

beforeEach(async () => {
  vi.resetModules();
  installFakeServiceWorkerScope();
  await import('../src/sw');
});

describe('sw.ts notificationclick', () => {
  it('focuses an already-open same-origin window and posts OPEN_PUSH_DESTINATION instead of navigating it', async () => {
    const client = fakeWindowClient('https://rondo.test/');
    matchAllMock.mockResolvedValue([client]);

    await dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: '/?open=match-chat&matchId=abc-123' } },
    });

    expect(client.focus).toHaveBeenCalled();
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'OPEN_PUSH_DESTINATION', url: '/?open=match-chat&matchId=abc-123' });
    expect(openWindowMock).not.toHaveBeenCalled();
  });

  it('opens a new window at the deep-link path when no window is open (app closed)', async () => {
    matchAllMock.mockResolvedValue([]);

    await dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: '/?open=match-ratings&matchId=xyz-789' } },
    });

    expect(openWindowMock).toHaveBeenCalledWith('/?open=match-ratings&matchId=xyz-789');
  });

  it('restricts navigation to the same origin: an external url falls back to /', async () => {
    matchAllMock.mockResolvedValue([]);

    await dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: 'https://evil.example.com/steal' } },
    });

    expect(openWindowMock).toHaveBeenCalledWith('/');
  });

  it('uses / as the fallback when notification data has no url at all', async () => {
    matchAllMock.mockResolvedValue([]);

    await dispatch('notificationclick', { notification: { close: vi.fn(), data: undefined } });

    expect(openWindowMock).toHaveBeenCalledWith('/');
  });

  it('closes the notification before acting on it', async () => {
    const close = vi.fn();
    matchAllMock.mockResolvedValue([]);

    await dispatch('notificationclick', { notification: { close, data: { url: '/?open=my-ratings' } } });

    expect(close).toHaveBeenCalled();
  });

  it('ignores an existing window on a different origin and opens a fresh one instead', async () => {
    const foreignClient = fakeWindowClient('https://not-rondo.test/');
    matchAllMock.mockResolvedValue([foreignClient]);

    await dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: '/?open=match-summary&matchId=abc-123' } },
    });

    expect(foreignClient.focus).not.toHaveBeenCalled();
    expect(openWindowMock).toHaveBeenCalledWith('/?open=match-summary&matchId=abc-123');
  });
});

describe('sw.ts push', () => {
  it('shows a notification carrying the payload url in its data, for notificationclick to read later', async () => {
    await dispatch('push', {
      data: { json: () => ({ title: 'Nueva invitación', body: 'Te invitaron', url: '/?open=invitations&invitationId=abc-123' }) },
    });

    expect(showNotificationMock).toHaveBeenCalledWith(
      'Nueva invitación',
      expect.objectContaining({ body: 'Te invitaron', data: expect.objectContaining({ url: '/?open=invitations&invitationId=abc-123' }) }),
    );
  });

  it('falls back to a generic notification when the push has no data at all', async () => {
    await dispatch('push', { data: null });

    expect(showNotificationMock).toHaveBeenCalledWith('Rondo', expect.objectContaining({ data: expect.objectContaining({ url: '/' }) }));
  });
});
