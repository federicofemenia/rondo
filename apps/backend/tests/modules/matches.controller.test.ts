import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';
import { createTestMatch, deleteTestMatch } from '../support/matchFactory.js';

beforeAll(async () => {
  await runSeed();
});

describe('POST /api/v1/matches', () => {
  const createdMatchIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
  });

  it('creates a match with the organizer auto-confirmed as a participant', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        clubId: SEED_IDS.club.senorPato,
        minPlayers: 4,
        maxPlayers: 10,
        positions: ['Arquero', 'Defensor'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      data: { id: string; status: string; organizerUserId: string; participantsCount: number; startsAt: string | null; endsAt: string | null; positions: string[] };
    };
    createdMatchIds.push(body.data.id);

    expect(body.data.status).toBe('ORGANIZING');
    expect(body.data.organizerUserId).toBe(SEED_IDS.users.juan);
    expect(body.data.participantsCount).toBe(1);
    expect(body.data.startsAt).toBeNull();
    expect(body.data.endsAt).toBeNull();
    expect(body.data.positions).toEqual(['Arquero', 'Defensor']);

    await app.close();
  });

  it('creates a match with a schedule when startsAt/endsAt are provided', async () => {
    const startsAt = new Date(Date.now() + 3600_000).toISOString();
    const endsAt = new Date(Date.now() + 7200_000).toISOString();

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        startsAt,
        endsAt,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: { id: string; startsAt: string | null; endsAt: string | null } };
    createdMatchIds.push(body.data.id);

    expect(body.data.startsAt).toBe(startsAt);
    expect(body.data.endsAt).toBe(endsAt);

    await app.close();
  });

  it('rejects a payload where maxPlayers is below minPlayers', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: { sportModalityId: SEED_IDS.modalities.football5, minPlayers: 10, maxPlayers: 4 },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a payload with only one of startsAt/endsAt set', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        startsAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a nonexistent sportModalityId', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: { sportModalityId: '00000000-0000-0000-0000-000000000000', minPlayers: 4, maxPlayers: 10 },
    });

    expect(response.statusCode).toBe(422);
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      payload: { sportModalityId: SEED_IDS.modalities.football5, minPlayers: 4, maxPlayers: 10 },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('POST /api/v1/matches/:matchId/cancellation', () => {
  const createdMatchIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
  });

  it('lets the organizer cancel and records who cancelled it and when', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status: 'ORGANIZING' });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/cancellation`,
      headers: { authorization: 'Bearer juan' },
      payload: { reason: 'Lluvia' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: { status: string; statusChangedByType: string; statusChangedByUser: { displayName: string } | null; cancellationReason: string };
    };
    expect(body.data.status).toBe('CANCELLED');
    expect(body.data.statusChangedByType).toBe('USER');
    expect(body.data.statusChangedByUser?.displayName).toBe('Juan Pérez');
    expect(body.data.cancellationReason).toBe('Lluvia');

    await app.close();
  });

  it('rejects cancellation attempted by someone other than the organizer', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status: 'ORGANIZING' });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/cancellation`,
      headers: { authorization: 'Bearer martin' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('cannot cancel a match already in a final state', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'COMPLETED',
      endsAt: new Date(Date.now() - 3600_000),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/cancellation`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });
});

describe('GET /api/v1/me/matches visibility', () => {
  const createdMatchIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
  });

  it('keeps active matches, keeps recently finished/cancelled ones, and hides them after 24 hours', async () => {
    const now = Date.now();

    const active = await createTestMatch({ organizerUserId: SEED_IDS.users.luciano, status: 'ORGANIZING' });
    const recentCancelled = await createTestMatch({
      organizerUserId: SEED_IDS.users.luciano,
      status: 'CANCELLED',
      statusChangedAt: new Date(now - 2 * 3600_000),
      statusChangedByType: 'USER',
      statusChangedByUserId: SEED_IDS.users.luciano,
    });
    const oldCancelled = await createTestMatch({
      organizerUserId: SEED_IDS.users.luciano,
      status: 'CANCELLED',
      statusChangedAt: new Date(now - 30 * 3600_000),
      statusChangedByType: 'USER',
      statusChangedByUserId: SEED_IDS.users.luciano,
    });
    const oldCompleted = await createTestMatch({
      organizerUserId: SEED_IDS.users.luciano,
      status: 'COMPLETED',
      endsAt: new Date(now - 30 * 3600_000),
      statusChangedAt: new Date(now - 30 * 3600_000),
    });
    const oldExpired = await createTestMatch({
      organizerUserId: SEED_IDS.users.luciano,
      status: 'EXPIRED',
      endsAt: new Date(now - 30 * 3600_000),
      statusChangedAt: new Date(now - 30 * 3600_000),
    });
    createdMatchIds.push(active.id, recentCancelled.id, oldCancelled.id, oldCompleted.id, oldExpired.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/matches', headers: { authorization: 'Bearer luciano' } });
    const ids = (response.json() as { data: Array<{ id: string }> }).data.map((item) => item.id);

    expect(ids).toContain(active.id);
    expect(ids).toContain(recentCancelled.id);
    expect(ids).not.toContain(oldCancelled.id);
    expect(ids).not.toContain(oldCompleted.id);
    expect(ids).not.toContain(oldExpired.id);

    await app.close();
  });
});
