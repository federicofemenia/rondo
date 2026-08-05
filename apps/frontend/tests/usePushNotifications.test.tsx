import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { urlBase64ToUint8Array, usePushNotifications } from '../src/usePushNotifications';
import { mockPushState } from './setup';

type FakeSubscription = {
  endpoint: string;
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
};

function fakeSubscription(endpoint: string): FakeSubscription {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p256dh-value', auth: 'auth-value' } }),
    unsubscribe: vi.fn(async () => true),
  };
}

function stubPushEnvironment(options: { permission?: NotificationPermission; existingSubscription?: FakeSubscription | null } = {}) {
  const { permission = 'default', existingSubscription = null } = options;

  let current = existingSubscription;
  const getSubscription = vi.fn(async () => current);
  const subscribe = vi.fn(async () => {
    current = fakeSubscription('https://push.example.com/new-endpoint');
    return current;
  });
  const requestPermission = vi.fn(async () => 'granted' as NotificationPermission);

  vi.stubGlobal('Notification', { permission, requestPermission });
  vi.stubGlobal('PushManager', class {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
  });

  return { getSubscription, subscribe, requestPermission };
}

function stubUnsupportedEnvironment() {
  vi.stubGlobal('Notification', undefined);
  vi.stubGlobal('PushManager', undefined);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
}

describe('urlBase64ToUint8Array', () => {
  it('converts a URL-safe base64 string into bytes', () => {
    // "test" in URL-safe base64.
    const result = urlBase64ToUint8Array('dGVzdA==');
    expect(Array.from(result)).toEqual([116, 101, 115, 116]);
  });

  it('pads an unpadded URL-safe base64 string before decoding', () => {
    const result = urlBase64ToUint8Array('dGVzdA');
    expect(Array.from(result)).toEqual([116, 101, 115, 116]);
  });
});

describe('usePushNotifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported when serviceWorker/PushManager/Notification are missing', () => {
    stubUnsupportedEnvironment();
    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.supported).toBe(false);
    expect(result.current.permission).toBe('unsupported');
  });

  it('reads the browser permission state (default/granted/denied) when supported', () => {
    stubPushEnvironment({ permission: 'denied' });
    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.supported).toBe(true);
    expect(result.current.permission).toBe('denied');
  });

  it('does not request permission or touch subscriptions on mount when there is no existing local subscription', () => {
    const { requestPermission, subscribe } = stubPushEnvironment({ permission: 'default' });
    renderHook(() => usePushNotifications());

    expect(requestPermission).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('reconciles an already-granted local subscription with the backend on mount, without prompting again', async () => {
    const existing = fakeSubscription('https://push.example.com/already-subscribed');
    const { requestPermission, subscribe } = stubPushEnvironment({ permission: 'granted', existingSubscription: existing });

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(requestPermission).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('enable() requests permission, subscribes, and persists the subscription to the backend', async () => {
    const { requestPermission, subscribe } = stubPushEnvironment({ permission: 'default' });
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.enable();
    });

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(result.current.enabled).toBe(true);
    expect(result.current.permission).toBe('granted');
    expect(result.current.error).toBeNull();
  });

  it('enable() does not subscribe again if a local subscription already exists', async () => {
    const existing = fakeSubscription('https://push.example.com/already-there');
    const { subscribe } = stubPushEnvironment({ permission: 'granted', existingSubscription: existing });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await act(async () => {
      await result.current.enable();
    });

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('enable() stops after a denied permission, without subscribing', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => 'denied' as NotificationPermission) });
    vi.stubGlobal('PushManager', class {});
    const subscribe = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn(async () => null), subscribe } }) },
    });

    const { result } = renderHook(() => usePushNotifications());
    await act(async () => {
      await result.current.enable();
    });

    expect(subscribe).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
    expect(result.current.permission).toBe('denied');
  });

  it('surfaces the backend error message when saving the subscription fails', async () => {
    mockPushState.saveFailing = true;
    stubPushEnvironment({ permission: 'default' });
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.enable();
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('disable() deletes the backend subscription before unsubscribing locally, then updates state', async () => {
    const existing = fakeSubscription('https://push.example.com/to-remove');
    stubPushEnvironment({ permission: 'granted', existingSubscription: existing });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await act(async () => {
      await result.current.disable();
    });

    expect(existing.unsubscribe).toHaveBeenCalledTimes(1);
    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('disable() leaves the local subscription intact and stays enabled when the backend delete fails', async () => {
    const existing = fakeSubscription('https://push.example.com/backend-fails');
    stubPushEnvironment({ permission: 'granted', existingSubscription: existing });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.enabled).toBe(true));

    mockPushState.deleteFailing = true;
    await act(async () => {
      await result.current.disable();
    });

    expect(existing.unsubscribe).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it('sendTest() calls the test endpoint and resolves on success', async () => {
    stubPushEnvironment({ permission: 'granted' });
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await expect(result.current.sendTest()).resolves.toBeUndefined();
    });

    expect(result.current.error).toBeNull();
  });

  it('sendTest() rejects and surfaces the backend error message on failure', async () => {
    mockPushState.testFailing = true;
    stubPushEnvironment({ permission: 'granted' });
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await expect(result.current.sendTest()).rejects.toBeTruthy();
    });

    expect(result.current.error).toBeTruthy();
  });
});
