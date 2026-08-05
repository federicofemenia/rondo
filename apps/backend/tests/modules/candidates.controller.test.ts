import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { User } from '@prisma/client';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { ARGENTINA_UTC_OFFSET_MINUTES } from '../../src/modules/matches/argentinaTime.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';
import { createTestMatch, deleteTestMatch } from '../support/matchFactory.js';

beforeAll(async () => {
  await runSeed();
});

// A day far enough in the future that it's never already past its own
// availability window (or even started) by the time the test runs -- only
// its derived day-of-week (via getUTCDay(), matching PlayerAvailability's
// convention) matters, never the actual date. Computed relative to the real
// clock rather than hardcoded, since a fixed calendar date eventually
// becomes "the past" and every franja-only match on it would immediately
// read as EXPIRED (rangeStartAt already gone) regardless of what the test
// is actually trying to exercise.
function futureUtcDay(daysFromNow: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow));
}

const TEST_DAY = futureUtcDay(30);
const TEST_DAY_OF_WEEK = TEST_DAY.getUTCDay();

/** A real UTC instant for `hour:minute` Argentina local time on TEST_DAY. */
function isoOnTestDay(hour: number, minute = 0): Date {
  return new Date(
    Date.UTC(TEST_DAY.getUTCFullYear(), TEST_DAY.getUTCMonth(), TEST_DAY.getUTCDate(), hour, minute + ARGENTINA_UTC_OFFSET_MINUTES, 0, 0),
  );
}

async function createCandidateUser(firstName: string, lastName = 'Test'): Promise<User> {
  return prisma.user.create({
    data: { clerkUserId: `test_candidate_${randomUUID()}`, email: `${randomUUID()}@example.com`, firstName, lastName },
  });
}

async function createSportProfile(
  userId: string,
  sportId: string,
  options: { positions?: string[]; isAvailableForInvitations?: boolean } = {},
) {
  return prisma.userSportProfile.create({
    data: {
      userId,
      sportId,
      positions: options.positions ?? [],
      isAvailableForInvitations: options.isAvailableForInvitations ?? true,
    },
  });
}

async function addAvailability(userSportProfileId: string, dayOfWeek: number, startMinutes: number, endMinutes: number) {
  return prisma.playerAvailability.create({ data: { userSportProfileId, dayOfWeek, startMinutes, endMinutes } });
}

async function deleteCandidateUser(userId: string): Promise<void> {
  const profiles = await prisma.userSportProfile.findMany({ where: { userId } });
  await prisma.playerAvailability.deleteMany({ where: { userSportProfileId: { in: profiles.map((profile) => profile.id) } } });
  await prisma.userSportProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

describe('GET /api/v1/matches/:matchId/candidates', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteCandidateUser));
  });

  it('rejects unauthenticated requests', async () => {
    const match = await createTestMatch({ scheduledDate: TEST_DAY, availabilityStartMinutes: 0, availabilityEndMinutes: 1440, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates` });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 404 for a nonexistent match', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/matches/00000000-0000-0000-0000-000000000000/candidates',
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('only returns candidates with a sport profile for the same sport', async () => {
    const footballPlayer = await createCandidateUser('Bruno');
    const padelPlayer = await createCandidateUser('Carla');
    createdUserIds.push(footballPlayer.id, padelPlayer.id);

    const footballProfile = await createSportProfile(footballPlayer.id, SEED_IDS.sports.football);
    await addAvailability(footballProfile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    const padelProfile = await createSportProfile(padelPlayer.id, SEED_IDS.sports.padel);
    await addAvailability(padelProfile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ id: string; sportId: string }> };
    const ids = body.data.map((candidate) => candidate.id);
    expect(ids).toContain(footballPlayer.id);
    expect(ids).not.toContain(padelPlayer.id);
    expect(body.data.find((candidate) => candidate.id === footballPlayer.id)?.sportId).toBe(SEED_IDS.sports.football);

    await app.close();
  });

  it('excludes players with invitations disabled', async () => {
    const unavailable = await createCandidateUser('Diego');
    createdUserIds.push(unavailable.id);

    const profile = await createSportProfile(unavailable.id, SEED_IDS.sports.football, { isAvailableForInvitations: false });
    await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as { data: Array<{ id: string }> };
    expect(body.data.map((candidate) => candidate.id)).not.toContain(unavailable.id);

    await app.close();
  });

  it('excludes the organizer even if they otherwise match', async () => {
    const organizer = await createCandidateUser('Elena');
    createdUserIds.push(organizer.id);

    const profile = await createSportProfile(organizer.id, SEED_IDS.sports.football);
    await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    const match = await createTestMatch({
      organizerUserId: organizer.id,
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as { data: Array<{ id: string }> };
    expect(body.data.map((candidate) => candidate.id)).not.toContain(organizer.id);

    await app.close();
  });

  it('excludes existing participants even if they otherwise match', async () => {
    const participant = await createCandidateUser('Fabián');
    createdUserIds.push(participant.id);

    const profile = await createSportProfile(participant.id, SEED_IDS.sports.football);
    await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
      participantUserIds: [participant.id],
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as { data: Array<{ id: string }> };
    expect(body.data.map((candidate) => candidate.id)).not.toContain(participant.id);

    await app.close();
  });

  it('excludes a candidate who already has a pending invitation for this match', async () => {
    const invited = await createCandidateUser('Renata');
    createdUserIds.push(invited.id);

    const profile = await createSportProfile(invited.id, SEED_IDS.sports.football);
    await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: invited.id, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as { data: Array<{ id: string }> };
    expect(body.data.map((candidate) => candidate.id)).not.toContain(invited.id);

    await app.close();
  });

  it('excludes a candidate whose invitation was rejected, since re-inviting them is blocked by the unique constraint', async () => {
    const invited = await createCandidateUser('Ignacio');
    createdUserIds.push(invited.id);

    const profile = await createSportProfile(invited.id, SEED_IDS.sports.football);
    await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: invited.id, invitedById: SEED_IDS.users.juan, status: 'REJECTED', respondedAt: new Date() },
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as { data: Array<{ id: string }> };
    expect(body.data.map((candidate) => candidate.id)).not.toContain(invited.id);

    await app.close();
  });

  describe('without an exact time (availability window overlap)', () => {
    it('includes a candidate whose weekly slot partially overlaps the window, and describes the overlap', async () => {
      const player = await createCandidateUser('Gabriela');
      createdUserIds.push(player.id);

      const profile = await createSportProfile(player.id, SEED_IDS.sports.football);
      await addAvailability(profile.id, TEST_DAY_OF_WEEK, 15 * 60, 18 * 60);

      const match = await createTestMatch({
        scheduledDate: TEST_DAY,
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt: null,
        endsAt: null,
      });
      createdMatchIds.push(match.id);

      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
      const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

      const body = response.json() as { data: Array<{ id: string; matchingAvailability: string }> };
      const candidate = body.data.find((current) => current.id === player.id);
      expect(candidate).toBeDefined();
      expect(candidate?.matchingAvailability).toBe('Disponible entre 15:00 y 18:00');

      await app.close();
    });

    it('excludes a candidate with no overlapping weekly slot', async () => {
      const player = await createCandidateUser('Horacio');
      createdUserIds.push(player.id);

      const profile = await createSportProfile(player.id, SEED_IDS.sports.football);
      await addAvailability(profile.id, TEST_DAY_OF_WEEK, 8 * 60, 12 * 60);

      const match = await createTestMatch({
        scheduledDate: TEST_DAY,
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt: null,
        endsAt: null,
      });
      createdMatchIds.push(match.id);

      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
      const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

      const body = response.json() as { data: Array<{ id: string }> };
      expect(body.data.map((candidate) => candidate.id)).not.toContain(player.id);

      await app.close();
    });

    it('excludes a candidate whose only slot is on a different day', async () => {
      const player = await createCandidateUser('Irene');
      createdUserIds.push(player.id);

      const profile = await createSportProfile(player.id, SEED_IDS.sports.football);
      await addAvailability(profile.id, (TEST_DAY_OF_WEEK + 1) % 7, 14 * 60, 19 * 60);

      const match = await createTestMatch({
        scheduledDate: TEST_DAY,
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt: null,
        endsAt: null,
      });
      createdMatchIds.push(match.id);

      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
      const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

      const body = response.json() as { data: Array<{ id: string }> };
      expect(body.data.map((candidate) => candidate.id)).not.toContain(player.id);

      await app.close();
    });
  });

  describe('with an exact time (full coverage required)', () => {
    it('includes a candidate whose weekly slot fully covers the exact time', async () => {
      const player = await createCandidateUser('Julieta');
      createdUserIds.push(player.id);

      const profile = await createSportProfile(player.id, SEED_IDS.sports.football);
      await addAvailability(profile.id, TEST_DAY_OF_WEEK, 16 * 60, 20 * 60);

      const match = await createTestMatch({
        scheduledDate: TEST_DAY,
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt: isoOnTestDay(17),
        endsAt: isoOnTestDay(18),
      });
      createdMatchIds.push(match.id);

      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
      const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

      const body = response.json() as { data: Array<{ id: string; matchingAvailability: string }> };
      const candidate = body.data.find((current) => current.id === player.id);
      expect(candidate).toBeDefined();
      expect(candidate?.matchingAvailability).toBe('Disponible');

      await app.close();
    });

    it('excludes a candidate whose weekly slot only partially covers the exact time', async () => {
      const player = await createCandidateUser('Karina');
      createdUserIds.push(player.id);

      const profile = await createSportProfile(player.id, SEED_IDS.sports.football);
      await addAvailability(profile.id, TEST_DAY_OF_WEEK, 17 * 60 + 30, 20 * 60);

      const match = await createTestMatch({
        scheduledDate: TEST_DAY,
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt: isoOnTestDay(17),
        endsAt: isoOnTestDay(18),
      });
      createdMatchIds.push(match.id);

      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
      const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

      const body = response.json() as { data: Array<{ id: string }> };
      expect(body.data.map((candidate) => candidate.id)).not.toContain(player.id);

      await app.close();
    });
  });

  describe('positions', () => {
    it('only returns candidates with a matching position when the match requires one', async () => {
      const goalkeeper = await createCandidateUser('Leandro');
      const forward = await createCandidateUser('Micaela');
      createdUserIds.push(goalkeeper.id, forward.id);

      const goalkeeperProfile = await createSportProfile(goalkeeper.id, SEED_IDS.sports.football, { positions: ['Arquero'] });
      await addAvailability(goalkeeperProfile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

      const forwardProfile = await createSportProfile(forward.id, SEED_IDS.sports.football, { positions: ['Delantero'] });
      await addAvailability(forwardProfile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

      const match = await createTestMatch({
        scheduledDate: TEST_DAY,
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt: null,
        endsAt: null,
      });
      createdMatchIds.push(match.id);
      await prisma.match.update({ where: { id: match.id }, data: { positions: ['Arquero'] } });

      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
      const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

      const body = response.json() as { data: Array<{ id: string }> };
      const ids = body.data.map((candidate) => candidate.id);
      expect(ids).toContain(goalkeeper.id);
      expect(ids).not.toContain(forward.id);

      await app.close();
    });

    it('does not filter by position when the match requires none', async () => {
      const goalkeeper = await createCandidateUser('Nicolás');
      const forward = await createCandidateUser('Olivia');
      createdUserIds.push(goalkeeper.id, forward.id);

      const goalkeeperProfile = await createSportProfile(goalkeeper.id, SEED_IDS.sports.football, { positions: ['Arquero'] });
      await addAvailability(goalkeeperProfile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

      const forwardProfile = await createSportProfile(forward.id, SEED_IDS.sports.football, { positions: ['Delantero'] });
      await addAvailability(forwardProfile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

      const match = await createTestMatch({
        scheduledDate: TEST_DAY,
        availabilityStartMinutes: 14 * 60,
        availabilityEndMinutes: 19 * 60,
        startsAt: null,
        endsAt: null,
      });
      createdMatchIds.push(match.id);

      const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
      const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

      const body = response.json() as { data: Array<{ id: string }> };
      const ids = body.data.map((candidate) => candidate.id);
      expect(ids).toContain(goalkeeper.id);
      expect(ids).toContain(forward.id);

      await app.close();
    });
  });

  it('returns candidates sorted alphabetically by name', async () => {
    const zoe = await createCandidateUser('Zoe');
    const ana = await createCandidateUser('Ana');
    const miguel = await createCandidateUser('Miguel');
    createdUserIds.push(zoe.id, ana.id, miguel.id);

    for (const user of [zoe, ana, miguel]) {
      const profile = await createSportProfile(user.id, SEED_IDS.sports.football);
      await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);
    }

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as { data: Array<{ id: string; displayName: string }> };
    const relevantNames = body.data.filter((candidate) => [zoe.id, ana.id, miguel.id].includes(candidate.id)).map((candidate) => candidate.displayName);
    expect(relevantNames).toEqual(['Ana Test', 'Miguel Test', 'Zoe Test']);

    await app.close();
  });

  it('shows the real displayName/username for a candidate with no firstName/lastName, not the generic "Jugador" fallback', async () => {
    // Matches the real beta registration flow (RegisterPage/Clerk sign-up),
    // which never sets firstName/lastName -- only username + displayName.
    const beta = await prisma.user.create({
      data: { clerkUserId: `test_candidate_${randomUUID()}`, username: 'candidato_beta', displayName: 'Candidato Beta' },
    });
    createdUserIds.push(beta.id);
    const profile = await createSportProfile(beta.id, SEED_IDS.sports.football);
    await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as { data: Array<{ id: string; displayName: string }> };
    const candidate = body.data.find((current) => current.id === beta.id);
    expect(candidate?.displayName).toBe('Candidato Beta');

    await app.close();
  });

  it("includes each candidate's ratings summary, computed with a single grouped query, with a null/zero shape for one with no ratings", async () => {
    const rated = await createCandidateUser('Marcos');
    const unrated = await createCandidateUser('Nadia');
    createdUserIds.push(rated.id, unrated.id);

    for (const candidate of [rated, unrated]) {
      const profile = await createSportProfile(candidate.id, SEED_IDS.sports.football);
      await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);
    }

    const ratingMatch = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, rated.id],
      status: 'COMPLETED',
      endsAt: new Date(Date.now() - 3600_000),
      statusChangedAt: new Date(Date.now() - 3600_000),
    });
    createdMatchIds.push(ratingMatch.id);
    await prisma.playerRating.create({
      data: { matchId: ratingMatch.id, authorUserId: SEED_IDS.users.juan, targetUserId: rated.id, gameplayScore: 5, conductScore: 4 },
    });

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as {
      data: Array<{
        id: string;
        ratings: {
          sportId: string;
          sportName: string;
          gameplayAverage: number | null;
          conductAverage: number | null;
          count: number;
          commentsCount: number;
        };
      }>;
    };
    const ratedCandidate = body.data.find((candidate) => candidate.id === rated.id);
    const unratedCandidate = body.data.find((candidate) => candidate.id === unrated.id);

    expect(ratedCandidate?.ratings).toEqual({
      sportId: SEED_IDS.sports.football,
      sportName: 'Fútbol',
      gameplayAverage: 5,
      conductAverage: 4,
      count: 1,
      commentsCount: 0,
    });
    expect(unratedCandidate?.ratings).toEqual({
      sportId: SEED_IDS.sports.football,
      sportName: 'Fútbol',
      gameplayAverage: null,
      conductAverage: null,
      count: 0,
      commentsCount: 0,
    });

    await app.close();
  });

  it("never mixes a candidate's ratings from a different sport into this match's candidate list", async () => {
    const candidate = await createCandidateUser('Rodrigo');
    createdUserIds.push(candidate.id);
    const profile = await createSportProfile(candidate.id, SEED_IDS.sports.football);
    await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

    // Real, well-formed ratings, but earned in padel -- must never surface
    // on a football match's candidate list.
    const padelMatch = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, candidate.id],
      status: 'COMPLETED',
      endsAt: new Date(Date.now() - 3600_000),
      statusChangedAt: new Date(Date.now() - 3600_000),
      sportModalityId: SEED_IDS.modalities.padelDoubles,
      courtId: SEED_IDS.courts.padel1,
    });
    createdMatchIds.push(padelMatch.id);
    await prisma.playerRating.create({
      data: { matchId: padelMatch.id, authorUserId: SEED_IDS.users.juan, targetUserId: candidate.id, gameplayScore: 5, conductScore: 5 },
    });

    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/candidates`, headers: { authorization: 'Bearer juan' } });

    const body = response.json() as { data: Array<{ id: string; ratings: { gameplayAverage: number | null; count: number } }> };
    const found = body.data.find((current) => current.id === candidate.id);
    expect(found?.ratings).toMatchObject({ gameplayAverage: null, count: 0 });

    await app.close();
  });
});
