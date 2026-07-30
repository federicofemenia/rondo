import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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

afterEach(async () => {
  await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
});

async function completedMatch(overrides: Parameters<typeof createTestMatch>[0] = {}) {
  const now = Date.now();
  const match = await createTestMatch({
    organizerUserId: SEED_IDS.users.juan,
    participantUserIds: [SEED_IDS.users.juan, SEED_IDS.users.martin, SEED_IDS.users.luciano],
    status: 'COMPLETED',
    endsAt: new Date(now - 2 * 3600_000),
    statusChangedAt: new Date(now - 2 * 3600_000),
    ...overrides,
  });
  createdMatchIds.push(match.id);
  return match;
}

describe('GET /api/v1/matches/:matchId/ratings enablement', () => {
  it('enables ratings for a COMPLETED match', async () => {
    const match = await completedMatch();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/ratings`, headers: { authorization: 'Bearer juan' } });

    expect(response.json().data.enabled).toBe(true);
    await app.close();
  });

  it('does not enable ratings for a CANCELLED match', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'CANCELLED',
      statusChangedAt: new Date(),
      statusChangedByType: 'USER',
      statusChangedByUserId: SEED_IDS.users.juan,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/ratings`, headers: { authorization: 'Bearer juan' } });

    expect(response.json().data.enabled).toBe(false);
    await app.close();
  });

  it('does not enable ratings for an EXPIRED match', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'EXPIRED',
      endsAt: new Date(Date.now() - 3600_000),
      statusChangedAt: new Date(),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/ratings`, headers: { authorization: 'Bearer juan' } });

    expect(response.json().data.enabled).toBe(false);
    await app.close();
  });

  it('returns a null closeAt (and does not crash) for an unscheduled ORGANIZING match', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan],
      status: 'ORGANIZING',
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/ratings`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.enabled).toBe(false);
    expect(response.json().data.closeAt).toBeNull();
    await app.close();
  });
});

describe('PUT /api/v1/matches/:matchId/ratings/:targetUserId validation', () => {
  it('rejects self-rating', async () => {
    const match = await completedMatch();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.juan}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 5, conductScore: 5 },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CANNOT_RATE_SELF');
    await app.close();
  });

  it('rejects a rating authored by a non-participant', async () => {
    const match = await completedMatch();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer ana' },
      payload: { gameplayScore: 5, conductScore: 5 },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NOT_A_PARTICIPANT');
    await app.close();
  });

  it('rejects rating a target who did not participate', async () => {
    const match = await completedMatch();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.ana}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 5, conductScore: 5 },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('TARGET_NOT_A_PARTICIPANT');
    await app.close();
  });

  it('rejects scores outside the 1-5 range', async () => {
    const match = await completedMatch();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 6, conductScore: 0 },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a comment longer than 300 characters', async () => {
    const match = await completedMatch();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 4, conductScore: 4, comment: 'a'.repeat(301) },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('enforces a unique rating per match, author and target at the database level', async () => {
    const match = await completedMatch();
    await prisma.playerRating.create({
      data: { matchId: match.id, authorUserId: SEED_IDS.users.juan, targetUserId: SEED_IDS.users.martin, gameplayScore: 4, conductScore: 4 },
    });

    await expect(
      prisma.playerRating.create({
        data: { matchId: match.id, authorUserId: SEED_IDS.users.juan, targetUserId: SEED_IDS.users.martin, gameplayScore: 2, conductScore: 2 },
      }),
    ).rejects.toThrow();
  });

  it('creates then edits the same rating within the open window without duplicating it', async () => {
    const match = await completedMatch();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });

    const first = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 3, conductScore: 3, comment: 'Bien' },
    });
    expect(first.statusCode).toBe(200);
    const firstId = (first.json() as { data: { id: string } }).data.id;

    const second = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 5, conductScore: 5, comment: 'Mejor de lo que pensé' },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as { data: { id: string; gameplayScore: number } };
    expect(secondBody.data.id).toBe(firstId);
    expect(secondBody.data.gameplayScore).toBe(5);

    const ratingsCount = await prisma.playerRating.count({ where: { matchId: match.id, authorUserId: SEED_IDS.users.juan, targetUserId: SEED_IDS.users.martin } });
    expect(ratingsCount).toBe(1);

    await app.close();
  });

  it('does not allow creating or editing a rating after the 7-day window closes', async () => {
    const match = await completedMatch({
      endsAt: new Date(Date.now() - 8 * 24 * 3600_000),
      statusChangedAt: new Date(Date.now() - 8 * 24 * 3600_000),
    });
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 5, conductScore: 5 },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('RATINGS_CLOSED');

    const listResponse = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/ratings`, headers: { authorization: 'Bearer juan' } });
    expect(listResponse.json().data.closed).toBe(true);

    await app.close();
  });
});
