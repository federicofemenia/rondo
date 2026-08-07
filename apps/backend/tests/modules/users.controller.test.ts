import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { createFakeAuthAdapter } from '../support/fakeAuthAdapter.js';

const TEST_USERNAME_REGULAR = 'test_username_regular';
const TEST_USERNAME_SECOND = 'test_username_second';
const TEST_USERNAME_ORDERING = 'test_username_ordering';

const authAdapter = createFakeAuthAdapter({
  'regular-user-token': { username: TEST_USERNAME_REGULAR, displayName: 'Jugador De Prueba' },
  'second-user-token': { username: TEST_USERNAME_SECOND, displayName: 'Federico Femenia', avatarUrl: 'https://example.com/avatar.png' },
});

beforeAll(async () => {
  await runSeed();
});

afterAll(async () => {
  const testUserIds = (
    await prisma.user.findMany({
      where: { username: { in: [TEST_USERNAME_REGULAR, TEST_USERNAME_SECOND, TEST_USERNAME_ORDERING] } },
      select: { id: true },
    })
  ).map((user) => user.id);

  await prisma.playerAvailability.deleteMany({ where: { userSportProfile: { userId: { in: testUserIds } } } });
  await prisma.userSportProfile.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.clubMembership.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  await prisma.$disconnect();
});

describe('GET /api/v1/me', () => {
  it('returns 401 when no token is provided', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('resolves the internal user from a valid session, consistently across calls', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });

    const first = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer regular-user-token' } });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as { data: { id: string; username: string | null; displayName: string } };
    expect(firstBody.data.username).toBe(TEST_USERNAME_REGULAR);
    expect(firstBody.data.displayName).toBe('Jugador De Prueba');

    const second = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer regular-user-token' } });
    const secondBody = second.json() as { data: { id: string } };

    expect(secondBody.data.id).toBe(firstBody.data.id);

    await app.close();
  });

  it('returns null email/firstName/lastName for an account created through native registration (no email/first/last name captured)', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer regular-user-token' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { email: string | null; firstName: string | null; lastName: string | null } };
    expect(body.data.email).toBeNull();
    expect(body.data.firstName).toBeNull();
    expect(body.data.lastName).toBeNull();

    await app.close();
  });

  it('returns the avatarUrl set on the account', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer second-user-token' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { avatarUrl: string | null } };
    expect(body.data.avatarUrl).toBe('https://example.com/avatar.png');

    await app.close();
  });

  // Default sport-profile backfill now only happens once, at real
  // registration time (auth.service.ts's registerUser) -- not as a
  // side-effect of authenticating, unlike the old Clerk-sync-on-every-request
  // model. See auth.controller.test.ts's "POST /register" suite for that
  // coverage; a fake-auth-adapter-resolved test user here (which never goes
  // through registerUser) has no default profiles.
});

describe('PUT /api/v1/me/profile', () => {
  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({ method: 'PUT', url: '/api/v1/me/profile', payload: { sex: null, biography: null } });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('persists sex and a trimmed biography, returned on the next GET /api/v1/me', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });

    const putResponse = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/profile',
      headers: { authorization: 'Bearer regular-user-token' },
      payload: { sex: 'MALE', biography: '  Juego todos los martes.  ' },
    });

    expect(putResponse.statusCode).toBe(200);
    const putBody = putResponse.json() as { data: { sex: string | null; biography: string | null } };
    expect(putBody.data.sex).toBe('MALE');
    expect(putBody.data.biography).toBe('Juego todos los martes.');

    const getResponse = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer regular-user-token' } });
    const getBody = getResponse.json() as { data: { sex: string | null; biography: string | null } };
    expect(getBody.data.sex).toBe('MALE');
    expect(getBody.data.biography).toBe('Juego todos los martes.');

    await app.close();
  });

  it('clears sex and biography when both are set to null', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    await app.inject({
      method: 'PUT',
      url: '/api/v1/me/profile',
      headers: { authorization: 'Bearer regular-user-token' },
      payload: { sex: 'FEMALE', biography: 'Algo.' },
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/profile',
      headers: { authorization: 'Bearer regular-user-token' },
      payload: { sex: null, biography: null },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { sex: string | null; biography: string | null } };
    expect(body.data.sex).toBeNull();
    expect(body.data.biography).toBeNull();

    await app.close();
  });

  it('rejects an invalid sex value', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/profile',
      headers: { authorization: 'Bearer regular-user-token' },
      payload: { sex: 'OTHER', biography: null },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a biography longer than 300 characters', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/profile',
      headers: { authorization: 'Bearer regular-user-token' },
      payload: { sex: null, biography: 'a'.repeat(301) },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects an avatarUrl that was not issued by our own avatar storage for this user', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/profile',
      headers: { authorization: 'Bearer regular-user-token' },
      payload: { sex: null, biography: null, avatarUrl: 'https://evil.example.com/x.png' },
    });

    // No R2 storage configured in this test server -- any avatarUrl is
    // rejected outright (see users.controller.ts's AVATAR_STORAGE_NOT_CONFIGURED-adjacent guard).
    expect(response.statusCode).toBe(400);

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

  it('does not include an INACTIVE membership: the user is treated as having no club', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer regular-user-token' } });
    const user = await prisma.user.findUnique({ where: { username: TEST_USERNAME_REGULAR } });

    await prisma.clubMembership.upsert({
      where: { clubId_userId: { clubId: SEED_IDS.club.senorPato, userId: user!.id } },
      update: { status: 'INACTIVE' },
      create: { clubId: SEED_IDS.club.senorPato, userId: user!.id, status: 'INACTIVE' },
    });

    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer regular-user-token' } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: [] });
    } finally {
      await prisma.clubMembership.deleteMany({ where: { userId: user!.id } });
      await app.close();
    }
  });

  it('never auto-grants any club membership or SUPERADMIN just from authenticating -- only auth:create-superadmin can promote', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter });
    await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer regular-user-token' } });

    const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer regular-user-token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });

    const user = await prisma.user.findUnique({ where: { username: TEST_USERNAME_REGULAR } });
    expect(user?.role).toBe('USER');

    await app.close();
  });

  it('orders clubs by isFavorite first, then by name ascending', async () => {
    const testUser = await prisma.user.create({
      data: { username: TEST_USERNAME_ORDERING, passwordHash: 'TEST_FIXTURE_NO_LOGIN' },
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
        'ordering-user-token': { username: TEST_USERNAME_ORDERING },
      });
      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: orderingAuthAdapter });
      const response = await app.inject({ method: 'GET', url: '/api/v1/me/clubs', headers: { authorization: 'Bearer ordering-user-token' } });
      const body = response.json() as { data: Array<{ name: string }> };

      expect(body.data.map((club) => club.name)).toEqual(['Mmm Club Favorito', 'Aaa Club', 'Zzz Club']);

      await app.close();
    } finally {
      await prisma.clubMembership.deleteMany({ where: { userId: testUser.id } });
      await prisma.playerAvailability.deleteMany({ where: { userSportProfile: { userId: testUser.id } } });
      await prisma.userSportProfile.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
      await prisma.club.deleteMany({ where: { id: { in: [clubZzz.id, clubAaa.id, clubFavorite.id] } } });
    }
  });
});
