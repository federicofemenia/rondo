import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock's factory is hoisted above every import in this file (including
// the `vitest` import above), so anything it references must go through
// vi.hoisted -- a plain top-level `const` here would throw a TDZ error at
// mock time (see https://vitest.dev/api/vi.html#vi-hoisted).
const { sendNotificationMock, setVapidDetailsMock, FakeWebPushError } = vi.hoisted(() => {
  class FakeWebPushError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return { sendNotificationMock: vi.fn(), setVapidDetailsMock: vi.fn(), FakeWebPushError };
});

// Hoisted by vitest above every import below, so buildServer (which
// transitively imports 'web-push' via push.service.ts) always sees this
// fake instead of the real network client. Never send a real push from a
// test -- see docs/WEB_PUSH.md.
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
    WebPushError: FakeWebPushError,
  },
}));

import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { createFakeAuthAdapter } from '../support/fakeAuthAdapter.js';

const OWNER_USERNAME = 'test_username_push_owner';
const BYSTANDER_USERNAME = 'test_username_push_bystander';
const ISOLATED_USERNAME = 'test_username_push_isolated';
/** Every endpoint fixture in this file uses this prefix, so it doubles as a cleanup key -- see beforeEach below. */
const TEST_ENDPOINT_PREFIX = 'https://push.example.com/';

const authAdapter = createFakeAuthAdapter({
  'owner-token': { username: OWNER_USERNAME, displayName: 'Push Owner' },
  'bystander-token': { username: BYSTANDER_USERNAME, displayName: 'Push Bystander' },
});

const VAPID_ENV = { VAPID_PUBLIC_KEY: 'test-public-key', VAPID_PRIVATE_KEY: 'test-private-key', VAPID_SUBJECT: 'mailto:admin@rondo.app' };

function buildConfiguredServer() {
  return buildServer({ NODE_ENV: 'test', ...VAPID_ENV }, { authAdapter });
}

function buildUnconfiguredServer() {
  return buildServer({ NODE_ENV: 'test' }, { authAdapter });
}

async function subscribe(app: Awaited<ReturnType<typeof buildServer>>, token: string, endpoint: string, keys = { p256dh: 'p256dh-value', auth: 'auth-value' }) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/me/push-subscriptions',
    headers: { authorization: `Bearer ${token}` },
    payload: { endpoint, keys },
  });
}

beforeAll(async () => {
  await runSeed();
});

// Every test that cares about "how many subscriptions does this user have"
// needs a clean slate -- without this, subscriptions created by earlier
// tests in this file (all sharing the same owner/bystander users) would
// keep accumulating and inflate sent/removed counts in later tests.
beforeEach(async () => {
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: TEST_ENDPOINT_PREFIX } } });
});

afterEach(() => {
  sendNotificationMock.mockReset();
  setVapidDetailsMock.mockReset();
});

afterAll(async () => {
  const testUserIds = (
    await prisma.user.findMany({
      where: { username: { in: [OWNER_USERNAME, BYSTANDER_USERNAME, ISOLATED_USERNAME] } },
      select: { id: true },
    })
  ).map((user) => user.id);

  await prisma.pushSubscription.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.playerAvailability.deleteMany({ where: { userSportProfile: { userId: { in: testUserIds } } } });
  await prisma.userSportProfile.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.clubMembership.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  await prisma.$disconnect();
});

describe('push-subscriptions auth', () => {
  it('requires auth on GET, POST, DELETE and the test endpoint', async () => {
    const app = await buildConfiguredServer();

    const get = await app.inject({ method: 'GET', url: '/api/v1/me/push-subscriptions' });
    const post = await app.inject({ method: 'POST', url: '/api/v1/me/push-subscriptions', payload: {} });
    const del = await app.inject({ method: 'DELETE', url: '/api/v1/me/push-subscriptions', payload: {} });
    const test = await app.inject({ method: 'POST', url: '/api/v1/me/push-subscriptions/test' });

    expect(get.statusCode).toBe(401);
    expect(post.statusCode).toBe(401);
    expect(del.statusCode).toBe(401);
    expect(test.statusCode).toBe(401);
    await app.close();
  });
});

describe('POST /api/v1/me/push-subscriptions', () => {
  it('saves a new subscription and returns the updated status', async () => {
    const app = await buildConfiguredServer();

    const response = await subscribe(app, 'owner-token', 'https://push.example.com/endpoint-save');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { enabled: boolean; subscriptions: Array<{ endpoint: string; userAgent: string | null }> } };
    expect(body.data.enabled).toBe(true);
    expect(body.data.subscriptions.map((subscription) => subscription.endpoint)).toContain('https://push.example.com/endpoint-save');

    await app.close();
  });

  it('upserts the same endpoint instead of creating a duplicate row', async () => {
    const app = await buildConfiguredServer();
    const endpoint = 'https://push.example.com/endpoint-upsert';

    await subscribe(app, 'owner-token', endpoint, { p256dh: 'first', auth: 'first-auth' });
    const second = await subscribe(app, 'owner-token', endpoint, { p256dh: 'second', auth: 'second-auth' });

    const body = second.json() as { data: { subscriptions: Array<{ endpoint: string }> } };
    const matching = body.data.subscriptions.filter((subscription) => subscription.endpoint === endpoint);
    expect(matching).toHaveLength(1);

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row?.p256dh).toBe('second');

    await app.close();
  });

  it('reassigns an endpoint to whichever user subscribes with it most recently (shared-device case)', async () => {
    const app = await buildConfiguredServer();
    const endpoint = 'https://push.example.com/endpoint-reassign';

    await subscribe(app, 'owner-token', endpoint);
    await subscribe(app, 'bystander-token', endpoint);

    const ownerStatus = await app.inject({ method: 'GET', url: '/api/v1/me/push-subscriptions', headers: { authorization: 'Bearer owner-token' } });
    const bystanderStatus = await app.inject({
      method: 'GET',
      url: '/api/v1/me/push-subscriptions',
      headers: { authorization: 'Bearer bystander-token' },
    });

    const ownerBody = ownerStatus.json() as { data: { subscriptions: Array<{ endpoint: string }> } };
    const bystanderBody = bystanderStatus.json() as { data: { subscriptions: Array<{ endpoint: string }> } };

    expect(ownerBody.data.subscriptions.map((subscription) => subscription.endpoint)).not.toContain(endpoint);
    expect(bystanderBody.data.subscriptions.map((subscription) => subscription.endpoint)).toContain(endpoint);

    await app.close();
  });

  it('rejects an invalid body (missing keys)', async () => {
    const app = await buildConfiguredServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/push-subscriptions',
      headers: { authorization: 'Bearer owner-token' },
      payload: { endpoint: 'https://push.example.com/endpoint-invalid' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /api/v1/me/push-subscriptions', () => {
  it('reports enabled: false and an empty list for a user with no subscriptions', async () => {
    const app = await buildConfiguredServer();

    const response = await app.inject({ method: 'GET', url: '/api/v1/me/push-subscriptions', headers: { authorization: 'Bearer bystander-token' } });
    const body = response.json() as { data: { enabled: boolean; subscriptions: unknown[] } };

    expect(body.data.enabled).toBe(false);
    expect(body.data.subscriptions).toEqual([]);
    await app.close();
  });

  it('never returns p256dh or auth', async () => {
    const app = await buildConfiguredServer();
    await subscribe(app, 'owner-token', 'https://push.example.com/endpoint-no-secrets');

    const response = await app.inject({ method: 'GET', url: '/api/v1/me/push-subscriptions', headers: { authorization: 'Bearer owner-token' } });
    const raw = response.body;

    expect(raw).not.toContain('p256dh');
    expect(raw).not.toContain('auth-value');
    await app.close();
  });
});

describe('DELETE /api/v1/me/push-subscriptions', () => {
  it('deletes a subscription belonging to the authenticated user', async () => {
    const app = await buildConfiguredServer();
    const endpoint = 'https://push.example.com/endpoint-delete-own';
    await subscribe(app, 'owner-token', endpoint);

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/me/push-subscriptions',
      headers: { authorization: 'Bearer owner-token' },
      payload: { endpoint },
    });

    expect(response.statusCode).toBe(204);
    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).toBeNull();

    await app.close();
  });

  it('does not delete a subscription belonging to another user', async () => {
    const app = await buildConfiguredServer();
    const endpoint = 'https://push.example.com/endpoint-delete-foreign';
    await subscribe(app, 'owner-token', endpoint);

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/me/push-subscriptions',
      headers: { authorization: 'Bearer bystander-token' },
      payload: { endpoint },
    });

    expect(response.statusCode).toBe(404);
    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).not.toBeNull();

    await app.close();
  });

  it('rejects an invalid endpoint value', async () => {
    const app = await buildConfiguredServer();

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/me/push-subscriptions',
      headers: { authorization: 'Bearer owner-token' },
      payload: { endpoint: 'not-a-url' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe('POST /api/v1/me/push-subscriptions/test', () => {
  it('configures VAPID from env at server build time', async () => {
    const app = await buildConfiguredServer();
    expect(setVapidDetailsMock).toHaveBeenCalledWith(VAPID_ENV.VAPID_SUBJECT, VAPID_ENV.VAPID_PUBLIC_KEY, VAPID_ENV.VAPID_PRIVATE_KEY);
    await app.close();
  });

  it('fails with 500 PUSH_NOT_CONFIGURED when VAPID env vars are missing', async () => {
    const app = await buildUnconfiguredServer();
    await subscribe(app, 'owner-token', 'https://push.example.com/endpoint-unconfigured');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/push-subscriptions/test',
      headers: { authorization: 'Bearer owner-token' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: { code: 'PUSH_NOT_CONFIGURED' } });
    await app.close();
  });

  it('returns 404 NO_PUSH_SUBSCRIPTIONS when the user has none', async () => {
    // A brand-new fake user, guaranteed to have zero subscriptions (cleaned
    // up alongside owner/bystander in the shared afterAll below).
    const isolatedAdapter = createFakeAuthAdapter({
      'isolated-token': { username: ISOLATED_USERNAME, displayName: 'Push Isolated' },
    });
    const isolatedApp = await buildServer({ NODE_ENV: 'test', ...VAPID_ENV }, { authAdapter: isolatedAdapter });

    const response = await isolatedApp.inject({
      method: 'POST',
      url: '/api/v1/me/push-subscriptions/test',
      headers: { authorization: 'Bearer isolated-token' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NO_PUSH_SUBSCRIPTIONS' } });

    await isolatedApp.close();
  });

  it('sends only to the authenticated user\'s own subscriptions, never a bystander\'s', async () => {
    const app = await buildConfiguredServer();
    await subscribe(app, 'owner-token', 'https://push.example.com/endpoint-test-owner');
    await subscribe(app, 'bystander-token', 'https://push.example.com/endpoint-test-bystander');
    sendNotificationMock.mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/push-subscriptions/test',
      headers: { authorization: 'Bearer owner-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { sent: number; removed: number } };
    expect(body.data.sent).toBe(1);
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    const [subscriptionArg] = sendNotificationMock.mock.calls[0] as [{ endpoint: string }, string];
    expect(subscriptionArg.endpoint).toBe('https://push.example.com/endpoint-test-owner');

    await app.close();
  });

  it('does not send a raw payload containing secrets (no VAPID keys, no p256dh/auth)', async () => {
    const app = await buildConfiguredServer();
    await subscribe(app, 'owner-token', 'https://push.example.com/endpoint-test-payload');
    sendNotificationMock.mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    await app.inject({ method: 'POST', url: '/api/v1/me/push-subscriptions/test', headers: { authorization: 'Bearer owner-token' } });

    const [, payloadArg] = sendNotificationMock.mock.calls.at(-1) as [{ endpoint: string }, string];
    expect(payloadArg).not.toContain(VAPID_ENV.VAPID_PRIVATE_KEY);
    expect(payloadArg).not.toContain('p256dh');
    expect(payloadArg).not.toContain('auth');
    const parsed = JSON.parse(payloadArg) as Record<string, unknown>;
    expect(parsed).toMatchObject({ title: 'Rondo', body: 'Las notificaciones están activadas.', url: '/', tag: 'rondo-push-test' });

    await app.close();
  });

  it('one failing subscription does not break delivery to the others', async () => {
    const app = await buildConfiguredServer();
    await subscribe(app, 'owner-token', 'https://push.example.com/endpoint-multi-a');
    await subscribe(app, 'owner-token', 'https://push.example.com/endpoint-multi-b');

    sendNotificationMock.mockImplementation(async (subscription: { endpoint: string }) => {
      if (subscription.endpoint === 'https://push.example.com/endpoint-multi-a') {
        throw new Error('network blip');
      }
      return { statusCode: 201, body: '', headers: {} };
    });

    const response = await app.inject({ method: 'POST', url: '/api/v1/me/push-subscriptions/test', headers: { authorization: 'Bearer owner-token' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { sent: number; removed: number } };
    expect(body.data.sent).toBe(1);
    expect(body.data.removed).toBe(0);

    // The subscription that merely failed (not 404/410) is not deleted --
    // only a confirmed-expired one is cleaned up.
    const stillThere = await prisma.pushSubscription.findUnique({ where: { endpoint: 'https://push.example.com/endpoint-multi-a' } });
    expect(stillThere).not.toBeNull();

    await app.close();
  });

  it('removes a subscription when the push service reports it expired (404/410)', async () => {
    const app = await buildConfiguredServer();
    const endpoint = 'https://push.example.com/endpoint-expired';
    await subscribe(app, 'owner-token', endpoint);

    sendNotificationMock.mockRejectedValue(new FakeWebPushError('gone', 410));

    const response = await app.inject({ method: 'POST', url: '/api/v1/me/push-subscriptions/test', headers: { authorization: 'Bearer owner-token' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { sent: number; removed: number } };
    expect(body.data.sent).toBe(0);
    expect(body.data.removed).toBe(1);

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).toBeNull();

    await app.close();
  });
});
