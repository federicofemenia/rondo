/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import type { PushNotificationPayloadDto } from '@rondo/contracts';

/**
 * Custom service worker source (injectManifest strategy -- see
 * vite.config.ts and docs/WEB_PUSH.md for why this replaced generateSW):
 * Workbox's generated `sw.js` had no way to add the `push` and
 * `notificationclick` listeners below, so this file takes over precaching
 * and the SPA navigation fallback by hand, using the same Workbox building
 * blocks generateSW used internally, then adds Web Push on top. There is
 * only ever one service worker for the whole app -- this file, registered
 * exactly as before via `virtual:pwa-register/react` in UpdatePrompt.tsx.
 */
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Same SPA fallback the previous generateSW config had via
// navigateFallback: '/index.html' + navigateFallbackDenylist: [/^\/api\//] --
// never intercepts /api/* (a different origin in every real deployment
// anyway, see docs/PWA.md) or anything that isn't a page navigation.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Same SKIP_WAITING handshake the previous generateSW output added
// automatically for registerType: 'prompt' -- UpdatePrompt.tsx is the only
// caller, and only once the user taps "Actualizar".
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', () => {
  void self.clients.claim();
});

const DEFAULT_ICON = '/pwa-192x192.png';
const DEFAULT_BADGE = '/pwa-192x192.png';
const FALLBACK_URL = '/';

/** Tolerates an empty push (no data at all) and malformed JSON -- a bad payload must never crash the worker or leave the user with no notification at all. */
function parsePushPayload(event: PushEvent): PushNotificationPayloadDto {
  const fallback: PushNotificationPayloadDto = { title: 'Rondo', body: 'Tenés una novedad en Rondo.', url: FALLBACK_URL };
  if (!event.data) {
    return fallback;
  }

  try {
    const parsed = event.data.json() as Partial<PushNotificationPayloadDto>;
    return {
      title: typeof parsed.title === 'string' && parsed.title ? parsed.title : fallback.title,
      body: typeof parsed.body === 'string' && parsed.body ? parsed.body : fallback.body,
      url: typeof parsed.url === 'string' && parsed.url ? parsed.url : fallback.url,
      tag: parsed.tag,
      icon: parsed.icon,
      badge: parsed.badge,
      data: parsed.data,
    };
  } catch {
    return fallback;
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? DEFAULT_ICON,
      badge: payload.badge ?? DEFAULT_BADGE,
      tag: payload.tag,
      data: { url: payload.url, ...payload.data },
    }),
  );
});

/** Never opens an arbitrary external URL from a push payload -- only ever navigates within Rondo's own origin, falling back to "/" for anything else (including a malformed URL). */
function resolveSameOriginPath(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') {
    return FALLBACK_URL;
  }
  try {
    const resolved = new URL(rawUrl, self.location.origin);
    return resolved.origin === self.location.origin ? `${resolved.pathname}${resolved.search}` : FALLBACK_URL;
  } catch {
    return FALLBACK_URL;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = resolveSameOriginPath((event.notification.data as { url?: unknown } | undefined)?.url);

  event.waitUntil(
    (async () => {
      const allClients = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) as WindowClient[];
      const existing = allClients.find((client) => new URL(client.url).origin === self.location.origin);

      if (existing) {
        await existing.focus();
        // Deep links (e.g. to a specific match/invitation) are a future
        // slice -- this build only ever sends "/", so there is nothing to
        // navigate to beyond focusing the existing window. Kept as a no-op
        // guard rather than calling navigate() unconditionally, since not
        // every browser's WindowClient supports it.
        if (targetPath !== '/' && 'navigate' in existing) {
          await existing.navigate(targetPath);
        }
        return;
      }

      await self.clients.openWindow(targetPath);
    })(),
  );
});
