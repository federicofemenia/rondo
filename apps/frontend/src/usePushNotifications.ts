import { useCallback, useEffect, useState } from 'react';
import type { PushSubscriptionStatusDto } from '@rondo/contracts';
import { ApiError, useApi } from './apiClient';
import { vapidPublicKey } from './runtimeConfig';

export type PushPermissionState = NotificationPermission | 'unsupported';

type UsePushNotificationsResult = {
  /** Feature-detected once per mount: 'serviceWorker' in navigator, 'PushManager' in window, 'Notification' in window. */
  supported: boolean;
  permission: PushPermissionState;
  /** Whether *this* browser/device currently has an active push subscription (granted permission + a live PushManager subscription). */
  enabled: boolean;
  loading: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  sendTest: () => Promise<void>;
};

/**
 * Converts the URL-safe base64 VAPID public key into the Uint8Array
 * PushManager.subscribe's applicationServerKey expects. Explicitly typed
 * `Uint8Array<ArrayBuffer>` (not the bare `Uint8Array` alias, which
 * defaults to the wider `ArrayBufferLike`) -- lib.dom's BufferSource wants
 * an ArrayBuffer-backed view specifically, and `new Uint8Array(length)`
 * already constructs exactly that.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function detectSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.serviceWorker !== 'undefined' &&
    typeof window !== 'undefined' &&
    typeof window.PushManager !== 'undefined' &&
    typeof window.Notification !== 'undefined'
  );
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Web Push activation state for the current device, backed by the
 * browser's own PushManager (source of truth for "is this device
 * subscribed") and Rondo's backend (source of truth for "does the server
 * know about it"). Never persists the subscription in localStorage --
 * both of those are the only two places this hook trusts, per
 * docs/WEB_PUSH.md.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const api = useApi();
  const [supported] = useState(detectSupport);

  const [permission, setPermission] = useState<PushPermissionState>(() => (detectSupport() ? Notification.permission : 'unsupported'));
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) {
      return;
    }

    let cancelled = false;

    const reconcile = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled || !subscription) {
          return;
        }
        // Already granted + subscribed from a previous session -- the
        // browser keeps this even if our own backend's row was ever lost
        // (a fresh DB, a different environment). Re-send it so the server
        // and "enabled" both catch up to what the browser already knows.
        await api.post<{ data: PushSubscriptionStatusDto }>('/api/v1/me/push-subscriptions', subscription.toJSON());
        if (!cancelled) {
          setEnabled(true);
        }
      } catch {
        // Best-effort: a failed reconciliation must not block the rest of
        // the app, and the user can still retry via "Activar" explicitly.
      }
    };

    void reconcile();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      await api.post<{ data: PushSubscriptionStatusDto }>('/api/v1/me/push-subscriptions', subscription.toJSON());
      setEnabled(true);
    } catch (caught) {
      setError(describeError(caught, 'No pudimos activar las notificaciones. Reintentá.'));
    } finally {
      setLoading(false);
    }
  }, [api, supported]);

  const disable = useCallback(async () => {
    if (!supported) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setEnabled(false);
        return;
      }

      // Backend first, on purpose: if this throws, the local subscription
      // stays intact so the UI keeps reflecting reality (still enabled)
      // instead of unsubscribing locally while an orphaned row survives
      // server-side -- see docs/WEB_PUSH.md.
      await api.delete('/api/v1/me/push-subscriptions', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      setEnabled(false);
    } catch (caught) {
      setError(describeError(caught, 'No pudimos desactivar las notificaciones. Reintentá.'));
    } finally {
      setLoading(false);
    }
  }, [api, supported]);

  const sendTest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/v1/me/push-subscriptions/test');
    } catch (caught) {
      setError(describeError(caught, 'No pudimos enviar la notificación de prueba.'));
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [api]);

  return { supported, permission, enabled, loading, error, enable, disable, sendTest };
}
