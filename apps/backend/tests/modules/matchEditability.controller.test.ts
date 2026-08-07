import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MatchStatus } from '@prisma/client';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';
import { createTestMatch, deleteTestMatch } from '../support/matchFactory.js';

beforeAll(async () => {
  await runSeed();
});

function futureUtcDay(daysFromNow: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow));
}

const createdMatchIds: string[] = [];

afterEach(async () => {
  await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
});

const schedulePayload = {
  venueType: 'CLUB' as const,
  clubId: SEED_IDS.club.senorPato,
  scheduledDate: futureUtcDay(2).toISOString().slice(0, 10),
  availabilityStartMinutes: 14 * 60,
  availabilityEndMinutes: 19 * 60,
  durationMinutes: 60,
};

const NON_EDITABLE_STATUSES: MatchStatus[] = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

describe('match editability -- only ORGANIZING/FULL, only before start/expiry', () => {
  it.each(NON_EDITABLE_STATUSES)('PATCH schedule is blocked with 409 MATCH_NOT_EDITABLE on a %s match', async (status) => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${match.id}/schedule`,
      headers: { authorization: 'Bearer juan' },
      payload: schedulePayload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_NOT_EDITABLE');
    await app.close();
  });

  it.each(NON_EDITABLE_STATUSES)('POST cancellation is blocked with 409 MATCH_NOT_EDITABLE on a %s match', async (status) => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/cancellation`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_NOT_EDITABLE');
    await app.close();
  });

  it.each(NON_EDITABLE_STATUSES)('GET candidates is blocked with 409 MATCH_NOT_EDITABLE on a %s match', async (status) => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/matches/${match.id}/candidates`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_NOT_EDITABLE');
    await app.close();
  });

  it.each(NON_EDITABLE_STATUSES)('POST invitations is blocked with 409 MATCH_NOT_EDITABLE on a %s match', async (status) => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status });
    createdMatchIds.push(match.id);
    const candidate = await prisma.user.create({
      data: { username: `test_editability_${match.id}`, passwordHash: 'TEST_FIXTURE_NO_LOGIN', email: `${match.id}@example.com`, firstName: 'Cande', lastName: 'Test' },
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: candidate.id },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_NOT_EDITABLE');

    await prisma.user.delete({ where: { id: candidate.id } });
    await app.close();
  });

  it('PATCH schedule succeeds on an ORGANIZING match that has not started yet', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status: 'ORGANIZING' });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${match.id}/schedule`,
      headers: { authorization: 'Bearer juan' },
      payload: schedulePayload,
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('PATCH schedule succeeds on a FULL match that has not started yet', async () => {
    // createTestMatch's default startsAt/endsAt straddle "now" (started an
    // hour ago) -- fine for ORGANIZING (which only expires on endsAt while
    // below minPlayers) but FULL has no such grace, so give it an explicit
    // future window instead to keep it FULL rather than IN_PROGRESS.
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'FULL',
      scheduledDate: futureUtcDay(2),
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${match.id}/schedule`,
      headers: { authorization: 'Bearer juan' },
      payload: schedulePayload,
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('a match already in progress (real startsAt/endsAt straddling now) is reported IN_PROGRESS and rejects a schedule edit, even though it was stored as ORGANIZING', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'ORGANIZING',
      minPlayers: 1,
      participantUserIds: [SEED_IDS.users.juan],
      startsAt: new Date(Date.now() - 10 * 60_000),
      endsAt: new Date(Date.now() + 50 * 60_000),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/matches/${match.id}/schedule`,
      headers: { authorization: 'Bearer juan' },
      payload: schedulePayload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_NOT_EDITABLE');

    const persisted = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(persisted.status).toBe('IN_PROGRESS');

    await app.close();
  });

  it('EXPIRED (franja-only, past its rangeStartAt) is persisted to the database, not just computed for the response', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'ORGANIZING',
      scheduledDate: new Date(Date.UTC(2020, 0, 1)),
      availabilityStartMinutes: 10 * 60,
      availabilityEndMinutes: 18 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/matches/${match.id}`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { status: string } }).data.status).toBe('EXPIRED');

    const persisted = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(persisted.status).toBe('EXPIRED');

    await app.close();
  });
});
