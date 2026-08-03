import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { createFakeAuthAdapter } from '../support/fakeAuthAdapter.js';

const TEST_CLERK_USER_ID = 'test_clerk_user_regular';
const TEST_ADMIN_CLERK_USER_ID = 'test_clerk_user_admin';
const TEST_USERNAME_ADMIN_CLERK_USER_ID = 'test_clerk_user_username_admin';
const TEST_NO_EMAIL_CLERK_USER_ID = 'test_clerk_user_no_email';

const authAdapter = createFakeAuthAdapter({
  'regular-user-token': {
    clerkUserId: TEST_CLERK_USER_ID,
    email: 'jugador.test@example.com',
    firstName: 'Jugador',
    lastName: 'De Prueba',
    avatarUrl: null,
  },
  'admin-user-token': {
    clerkUserId: TEST_ADMIN_CLERK_USER_ID,
    email: 'admin.test@example.com',
    firstName: 'Federico',
    lastName: 'Femenia',
    avatarUrl: 'https://example.com/avatar.png',
  },
  'username-admin-token': {
    clerkUserId: TEST_USERNAME_ADMIN_CLERK_USER_ID,
    username: 'fede',
    email: null,
    firstName: null,
    lastName: null,
    avatarUrl: null,
  },
  'no-email-token': {
    clerkUserId: TEST_NO_EMAIL_CLERK_USER_ID,
    username: 'sinmail',
    email: null,
    firstName: null,
    lastName: null,
    avatarUrl: null,
  },
});

beforeAll(async () => {
  await runSeed();
});

afterAll(async () => {
  await prisma.clubMembership.deleteMany({
    where: {
      user: {
        clerkUserId: { in: [TEST_CLERK_USER_ID, TEST_ADMIN_CLERK_USER_ID, TEST_USERNAME_ADMIN_CLERK_USER_ID, TEST_NO_EMAIL_CLERK_USER_ID] },
      },
    },
  });
  await prisma.user.deleteMany({
    where: { clerkUserId: { in: [TEST_CLERK_USER_ID, TEST_ADMIN_CLERK_USER_ID, TEST_USERNAME_ADMIN_CLERK_USER_ID, TEST_NO_EMAIL_CLERK_USER_ID] } },
  });
  await prisma.$disconnect();
});

describe('GET /api/v1/me', () => {
  it('returns 401 when no token is provided', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('creates the internal user on first login and returns it on subsequent calls', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });

    const first = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer regular-user-token' } });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as { data: { id: string; email: string; firstName: string | null } };
    expect(firstBody.data.email).toBe('jugador.test@example.com');
    expect(firstBody.data.firstName).toBe('Jugador');

    const second = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer regular-user-token' } });
    const secondBody = second.json() as { data: { id: string } };

    expect(secondBody.data.id).toBe(firstBody.data.id);

    await app.close();
  });

  it('syncs a username-only account with no email at all, without failing', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer no-email-token' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { username: string | null; email: string | null; displayName: string } };
    expect(body.data.username).toBe('sinmail');
    expect(body.data.email).toBeNull();
    expect(body.data.displayName).toBe('sinmail');

    await app.close();
  });
});

describe('GET /api/v1/me/clubs', () => {
  it('returns an empty list for a user with no memberships', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer regular-user-token' } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });

    await app.close();
  });

  it('does not grant admin membership when no BOOTSTRAP_ADMIN_* is configured', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer admin-user-token' } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });

    await app.close();
  });

  it('auto-grants a CLUB_ADMIN favorite membership at Señor Pato when BOOTSTRAP_ADMIN_CLERK_USER_ID matches', async () => {
    const app = await buildServer({ NODE_ENV: 'test', BOOTSTRAP_ADMIN_CLERK_USER_ID: TEST_ADMIN_CLERK_USER_ID }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer admin-user-token' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{ id: string; code: string; name: string; role: string; status: string; isFavorite: boolean }>;
    };

    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: SEED_IDS.club.senorPato,
      code: 'senor-pato',
      name: 'Señor Pato',
      role: 'CLUB_ADMIN',
      status: 'ACTIVE',
      isFavorite: true,
    });

    await app.close();
  });

  it('auto-grants admin membership when BOOTSTRAP_ADMIN_USERNAME matches (dev-only fallback)', async () => {
    const app = await buildServer({ NODE_ENV: 'test', BOOTSTRAP_ADMIN_USERNAME: 'fede' }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer username-admin-token' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ role: string }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ role: 'CLUB_ADMIN' });

    await app.close();
  });

  it('orders clubs by isFavorite first, then by name ascending', async () => {
    const testUser = await prisma.user.create({
      data: { clerkUserId: 'test_clerk_user_ordering', email: 'ordering.test@example.com' },
    });
    const clubZzz = await prisma.club.create({
      data: { code: 'test-zzz-club', name: 'Zzz Club', timezone: 'America/Argentina/Buenos_Aires' },
    });
    const clubAaa = await prisma.club.create({
      data: { code: 'test-aaa-club', name: 'Aaa Club', timezone: 'America/Argentina/Buenos_Aires' },
    });
    const clubFavorite = await prisma.club.create({
      data: { code: 'test-mmm-club-favorite', name: 'Mmm Club Favorito', timezone: 'America/Argentina/Buenos_Aires' },
    });

    try {
      await prisma.clubMembership.createMany({
        data: [
          { clubId: clubZzz.id, userId: testUser.id, isFavorite: false },
          { clubId: clubAaa.id, userId: testUser.id, isFavorite: false },
          { clubId: clubFavorite.id, userId: testUser.id, isFavorite: true },
        ],
      });

      const orderingAuthAdapter = createFakeAuthAdapter({
        'ordering-user-token': {
          clerkUserId: 'test_clerk_user_ordering',
          email: 'ordering.test@example.com',
          firstName: null,
          lastName: null,
          avatarUrl: null,
        },
      });
      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: orderingAuthAdapter });
      const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer ordering-user-token' } });
      const body = response.json() as { data: Array<{ name: string }> };

      expect(body.data.map((club) => club.name)).toEqual(['Mmm Club Favorito', 'Aaa Club', 'Zzz Club']);

      await app.close();
    } finally {
      await prisma.clubMembership.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
      await prisma.club.deleteMany({ where: { id: { in: [clubZzz.id, clubAaa.id, clubFavorite.id] } } });
    }
  });

  it('is idempotent: logging in twice does not duplicate the membership', async () => {
    const app = await buildServer({ NODE_ENV: 'test', BOOTSTRAP_ADMIN_CLERK_USER_ID: TEST_ADMIN_CLERK_USER_ID }, { authAdapter });
    await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer admin-user-token' } });
    await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer admin-user-token' } });

    const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer admin-user-token' } });
    const body = response.json() as { data: unknown[] };

    expect(body.data).toHaveLength(1);

    await app.close();
  });
});
