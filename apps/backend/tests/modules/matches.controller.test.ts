import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';
import { createTestMatch, deleteTestMatch } from '../support/matchFactory.js';

beforeAll(async () => {
  await runSeed();
});

function dateStringDaysFromNow(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

/** ISO datetime for `hour:minute` UTC on the day `days` from now (football-5 duration is 60 minutes). */
function isoAtHour(days: number, hour: number, minute = 0): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0, 0)).toISOString();
}

describe('POST /api/v1/matches', () => {
  const createdMatchIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
  });

  it('creates a match with just a scheduled day, the organizer auto-confirmed, and no startsAt/endsAt', async () => {
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
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      data: {
        id: string;
        status: string;
        organizerUserId: string;
        participantsCount: number;
        scheduledDate: string;
        availabilityStartMinutes: number;
        availabilityEndMinutes: number;
        startsAt: string | null;
        endsAt: string | null;
        positions: string[];
      };
    };
    createdMatchIds.push(body.data.id);

    expect(body.data.status).toBe('ORGANIZING');
    expect(body.data.organizerUserId).toBe(SEED_IDS.users.juan);
    expect(body.data.participantsCount).toBe(1);
    expect(body.data.scheduledDate).toBe(dateStringDaysFromNow(2));
    expect(body.data.availabilityStartMinutes).toBe(14 * 60);
    expect(body.data.availabilityEndMinutes).toBe(19 * 60);
    expect(body.data.startsAt).toBeNull();
    expect(body.data.endsAt).toBeNull();
    expect(body.data.positions).toEqual(['Arquero', 'Defensor']);

    await app.close();
  });

  it('computes endsAt automatically from the modality duration when startsAt is provided', async () => {
    const startsAt = isoAtHour(2, 17);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: { id: string; startsAt: string | null; endsAt: string | null } };
    createdMatchIds.push(body.data.id);

    expect(body.data.startsAt).toBe(startsAt);
    // football-5 duration is 60 minutes: 17:00 -> 18:00.
    expect(body.data.endsAt).toBe(isoAtHour(2, 18));

    await app.close();
  });

  it('accepts a startsAt that ends exactly at the edge of the availability window', async () => {
    const startsAt = isoAtHour(2, 18);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: { id: string; endsAt: string | null } };
    createdMatchIds.push(body.data.id);
    expect(body.data.endsAt).toBe(isoAtHour(2, 19));

    await app.close();
  });

  it('rejects a startsAt whose computed end time falls outside the availability window', async () => {
    const startsAt = isoAtHour(2, 18, 30);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt,
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('STARTS_AT_OUTSIDE_AVAILABILITY');
    await app.close();
  });

  it('rejects a payload missing scheduledDate', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        availabilityStartMinutes: 600,
        availabilityEndMinutes: 1200,
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a scheduledDate in the past', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        scheduledDate: dateStringDaysFromNow(-1),
        availabilityStartMinutes: 600,
        availabilityEndMinutes: 1200,
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects an availability window where end is not after start', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 1200,
        availabilityEndMinutes: 600,
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a startsAt outside the chosen day', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt: isoAtHour(3, 17),
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a payload where maxPlayers is below minPlayers', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: 'Bearer juan' },
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 10,
        maxPlayers: 4,
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 600,
        availabilityEndMinutes: 1200,
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
      payload: {
        sportModalityId: '00000000-0000-0000-0000-000000000000',
        minPlayers: 4,
        maxPlayers: 10,
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 600,
        availabilityEndMinutes: 1200,
      },
    });

    expect(response.statusCode).toBe(422);
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      payload: {
        sportModalityId: SEED_IDS.modalities.football5,
        minPlayers: 4,
        maxPlayers: 10,
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 600,
        availabilityEndMinutes: 1200,
      },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('PATCH /api/v1/matches/:matchId/schedule', () => {
  const createdMatchIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
  });

  it('lets the organizer set a time on a match that had none, recalculating endsAt', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'ORGANIZING',
      scheduledDate: new Date(dateStringDaysFromNow(2)),
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const startsAt = isoAtHour(2, 17);
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${match.id}/schedule`,
      headers: { authorization: 'Bearer juan' },
      payload: {
        scheduledDate: dateStringDaysFromNow(2),
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { startsAt: string | null; endsAt: string | null } };
    expect(body.data.startsAt).toBe(startsAt);
    expect(body.data.endsAt).toBe(isoAtHour(2, 18));

    await app.close();
  });

  it('lets the organizer move the day and widen the availability window', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'ORGANIZING',
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${match.id}/schedule`,
      headers: { authorization: 'Bearer juan' },
      payload: {
        scheduledDate: dateStringDaysFromNow(5),
        availabilityStartMinutes: 10 * 60,
        availabilityEndMinutes: 22 * 60,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { scheduledDate: string; availabilityStartMinutes: number; availabilityEndMinutes: number } };
    expect(body.data.scheduledDate).toBe(dateStringDaysFromNow(5));
    expect(body.data.availabilityStartMinutes).toBe(10 * 60);
    expect(body.data.availabilityEndMinutes).toBe(22 * 60);

    await app.close();
  });

  it('rejects editing when the acting user is not the organizer', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status: 'ORGANIZING' });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${match.id}/schedule`,
      headers: { authorization: 'Bearer martin' },
      payload: { scheduledDate: dateStringDaysFromNow(2), availabilityStartMinutes: 600, availabilityEndMinutes: 1200 },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it.each(['COMPLETED', 'CANCELLED', 'EXPIRED'] as const)('rejects editing a %s match', async (status) => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status,
      endsAt: new Date(Date.now() - 3600_000),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${match.id}/schedule`,
      headers: { authorization: 'Bearer juan' },
      payload: { scheduledDate: dateStringDaysFromNow(2), availabilityStartMinutes: 600, availabilityEndMinutes: 1200 },
    });

    expect(response.statusCode).toBe(409);
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
