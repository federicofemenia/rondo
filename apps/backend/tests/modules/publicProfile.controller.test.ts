import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { User } from '@prisma/client';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';
import { createTestMatch, deleteTestMatch } from '../support/matchFactory.js';

beforeAll(async () => {
  await runSeed();
});

const createdMatchIds: string[] = [];
const createdUserIds: string[] = [];

afterEach(async () => {
  await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
  for (const userId of createdUserIds.splice(0)) {
    await prisma.playerAvailability.deleteMany({ where: { userSportProfile: { userId } } });
    await prisma.userSportProfile.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

async function createBareUser(overrides: Partial<Pick<User, 'biography' | 'avatarUrl' | 'sex' | 'firstName' | 'lastName'>> = {}): Promise<User> {
  const user = await prisma.user.create({
    data: { clerkUserId: `test_public_profile_${randomUUID()}`, email: `${randomUUID()}@example.com`, ...overrides },
  });
  createdUserIds.push(user.id);
  return user;
}

async function rateTarget(targetUserId: string, authorUserId: string, gameplayScore: number, conductScore: number, comment?: string) {
  const match = await createTestMatch({
    organizerUserId: authorUserId,
    participantUserIds: [authorUserId, targetUserId],
    status: 'COMPLETED',
    endsAt: new Date(Date.now() - 3600_000),
    statusChangedAt: new Date(Date.now() - 3600_000),
  });
  createdMatchIds.push(match.id);

  await prisma.playerRating.create({
    data: { matchId: match.id, authorUserId, targetUserId, gameplayScore, conductScore, comment: comment ?? null },
  });

  return match;
}

describe('GET /api/v1/users/:id/public-profile', () => {
  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/users/${SEED_IDS.users.juan}/public-profile` });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 404 for a nonexistent user', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${randomUUID()}/public-profile`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns displayName, avatarUrl, sex, biography, positions and ratings, and never exposes private fields', async () => {
    const target = await createBareUser({ biography: 'Juego todos los martes.', sex: 'MALE', avatarUrl: 'https://example.com/a.png' });
    await prisma.userSportProfile.create({
      data: { userId: target.id, sportId: SEED_IDS.sports.football, positions: ['Delantero', 'Mediocampista'], isAvailableForInvitations: true },
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.id}/public-profile`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      id: target.id,
      avatarUrl: 'https://example.com/a.png',
      sex: 'MALE',
      biography: 'Juego todos los martes.',
    });
    expect((body.data.positions as string[]).sort()).toEqual(['Delantero', 'Mediocampista']);
    expect(body.data.ratings).toEqual({ gameplayAverage: null, conductAverage: null, count: 0 });

    expect(body.data.email).toBeUndefined();
    expect(body.data.username).toBeUndefined();
    expect(body.data.clerkUserId).toBeUndefined();

    await app.close();
  });

  it('returns null biography and null avatarUrl for a user who set neither', async () => {
    const target = await createBareUser();

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.id}/public-profile`,
      headers: { authorization: 'Bearer juan' },
    });

    const body = response.json() as { data: { biography: string | null; avatarUrl: string | null } };
    expect(body.data.biography).toBeNull();
    expect(body.data.avatarUrl).toBeNull();

    await app.close();
  });

  it('deduplicates positions across multiple sport profiles', async () => {
    const target = await createBareUser();
    await prisma.userSportProfile.create({
      data: { userId: target.id, sportId: SEED_IDS.sports.football, positions: ['Delantero'], isAvailableForInvitations: true },
    });
    await prisma.userSportProfile.create({
      data: { userId: target.id, sportId: SEED_IDS.sports.padel, positions: ['Delantero'], isAvailableForInvitations: true },
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.id}/public-profile`,
      headers: { authorization: 'Bearer juan' },
    });

    const body = response.json() as { data: { positions: string[] } };
    expect(body.data.positions).toEqual(['Delantero']);

    await app.close();
  });

  it('reflects the aggregated ratings average and count', async () => {
    const target = await createBareUser();
    await rateTarget(target.id, SEED_IDS.users.juan, 4, 5);
    await rateTarget(target.id, SEED_IDS.users.martin, 2, 3);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.id}/public-profile`,
      headers: { authorization: 'Bearer juan' },
    });

    const body = response.json() as { data: { ratings: { gameplayAverage: number; conductAverage: number; count: number } } };
    expect(body.data.ratings).toEqual({ gameplayAverage: 3, conductAverage: 4, count: 2 });

    await app.close();
  });
});

describe('GET /api/v1/users/:id/rating-comments', () => {
  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/users/${SEED_IDS.users.juan}/rating-comments` });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns "no comments" as an empty list for a user with none', async () => {
    const target = await createBareUser();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.id}/rating-comments`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });

    await app.close();
  });

  it('only returns ratings that carry written text, with author, scores, sport, modality and date', async () => {
    const target = await createBareUser();
    await rateTarget(target.id, SEED_IDS.users.juan, 5, 4, 'Muy buen compañero.');
    await rateTarget(target.id, SEED_IDS.users.martin, 3, 3);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.id}/rating-comments`,
      headers: { authorization: 'Bearer juan' },
    });

    const body = response.json() as {
      data: Array<{ authorDisplayName: string; gameplayScore: number; conductScore: number; comment: string; sportName: string; modalityName: string; createdAt: string }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      authorDisplayName: 'Juan Pérez',
      gameplayScore: 5,
      conductScore: 4,
      comment: 'Muy buen compañero.',
      sportName: 'Fútbol',
      modalityName: 'Fútbol 5',
    });
    expect(typeof body.data[0]!.createdAt).toBe('string');

    await app.close();
  });

  it('orders comments most recent first', async () => {
    const target = await createBareUser();
    const older = await rateTarget(target.id, SEED_IDS.users.juan, 4, 4, 'Primero.');
    await prisma.playerRating.updateMany({ where: { matchId: older.id }, data: { createdAt: new Date(Date.now() - 60_000) } });
    await rateTarget(target.id, SEED_IDS.users.martin, 5, 5, 'Segundo.');

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.id}/rating-comments`,
      headers: { authorization: 'Bearer juan' },
    });

    const body = response.json() as { data: Array<{ comment: string }> };
    expect(body.data.map((comment) => comment.comment)).toEqual(['Segundo.', 'Primero.']);

    await app.close();
  });

  it('never returns more than 20 comments', async () => {
    const target = await createBareUser();
    const raters: string[] = [];
    for (let i = 0; i < 21; i += 1) {
      const rater = await createBareUser();
      raters.push(rater.id);
      await rateTarget(target.id, rater.id, 5, 5, `Comentario ${i}.`);
    }

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.id}/rating-comments`,
      headers: { authorization: 'Bearer juan' },
    });

    const body = response.json() as { data: unknown[] };
    expect(body.data).toHaveLength(20);

    await app.close();
  });
});
