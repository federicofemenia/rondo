import webpush from 'web-push';
import type { PushSubscription as PrismaPushSubscription } from '@prisma/client';
import type {
  PushNotificationPayloadDto,
  PushSubscriptionInputDto,
  PushSubscriptionStatusDto,
  TestPushResponseDto,
} from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { MatchServiceError } from '../matches/errors.js';

export type VapidEnv = {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

let configured = false;

/**
 * Sets the VAPID key pair on the shared web-push client. Called once from
 * buildServer (see app/server.ts), including in every test server -- safe to
 * call with missing keys (dev/test can boot without VAPID configured at
 * all); sendPushToUser is what fails loudly, and only if a send is actually
 * attempted while unconfigured.
 */
export function configureWebPush(env: VapidEnv): void {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    configured = false;
    return;
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

function toStatusDto(subscriptions: PrismaPushSubscription[]): PushSubscriptionStatusDto {
  return {
    enabled: subscriptions.length > 0,
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      endpoint: subscription.endpoint,
      createdAt: subscription.createdAt.toISOString(),
      userAgent: subscription.userAgent,
    })),
  };
}

export async function listSubscriptions(userId: string): Promise<PushSubscriptionStatusDto> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return toStatusDto(subscriptions);
}

/**
 * Upserts by endpoint (not userId+endpoint): the browser's own push
 * endpoint already uniquely identifies this device's registration, so
 * re-subscribing always means "this is still the same physical
 * subscription, associate it with whoever is authenticated right now."
 * That is also the deliberate fix for a shared device: if a different
 * user logs in on a browser where someone else previously enabled push and
 * subscribes again, this reassigns the row to the new user -- the old
 * account stops receiving pushes meant for a session that is no longer
 * theirs. See docs/WEB_PUSH.md for the full reasoning.
 */
export async function saveSubscription(
  userId: string,
  input: PushSubscriptionInputDto,
  userAgent: string | null,
): Promise<PushSubscriptionStatusDto> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent },
    create: { userId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent },
  });
  return listSubscriptions(userId);
}

/**
 * Only ever deletes a row that actually belongs to `userId` -- an endpoint
 * that exists but belongs to someone else is treated identically to one
 * that doesn't exist at all, so this never leaks whether another account
 * has it.
 */
export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  const result = await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  if (result.count === 0) {
    throw new MatchServiceError(404, 'PUSH_SUBSCRIPTION_NOT_FOUND', 'Esa suscripción no existe.');
  }
}

const DEFAULT_ICON = '/pwa-192x192.png';
const DEFAULT_BADGE = '/pwa-192x192.png';

/** 404/410 from the push service means the browser itself invalidated this endpoint (uninstalled, cleared data, expired) -- never coming back, safe to delete. */
function isExpiredSubscriptionError(error: unknown): boolean {
  return error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410);
}

/**
 * Sends `payload` to every one of `userId`'s active subscriptions. A
 * failure on one device (expired, network blip, malformed) never aborts
 * the others -- each subscription is sent independently, and its own
 * failure is swallowed (after cleanup, for expired ones) rather than
 * rejecting the whole batch. Reusable as-is by a future slice that connects
 * real business events (invitations, chat, etc.) -- nothing here is
 * test-notification-specific.
 */
export async function sendPushToUser(userId: string, payload: PushNotificationPayloadDto): Promise<TestPushResponseDto> {
  if (!configured) {
    throw new MatchServiceError(500, 'PUSH_NOT_CONFIGURED', 'El servidor no tiene configuradas las claves VAPID.');
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) {
    throw new MatchServiceError(404, 'NO_PUSH_SUBSCRIPTIONS', 'No tenés notificaciones activadas en ningún dispositivo.');
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    icon: payload.icon ?? DEFAULT_ICON,
    badge: payload.badge ?? DEFAULT_BADGE,
    data: payload.data,
  });

  let sent = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, body);
        sent += 1;
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
          removed += 1;
        }
        // Any other per-subscription failure (network blip, malformed
        // payload) is swallowed here on purpose: one bad device must never
        // fail the whole batch for the user's other devices.
      }
    }),
  );

  return { sent, removed };
}

const TEST_PUSH_PAYLOAD: PushNotificationPayloadDto = {
  title: 'Rondo',
  body: 'Las notificaciones están activadas.',
  url: '/',
  tag: 'rondo-push-test',
};

export function sendTestNotification(userId: string): Promise<TestPushResponseDto> {
  return sendPushToUser(userId, TEST_PUSH_PAYLOAD);
}
