import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { User } from '@prisma/client';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';
import { createFakeAuthAdapter } from '../support/fakeAuthAdapter.js';
import { createTestMatch, deleteTestMatch } from '../support/matchFactory.js';

beforeAll(async () => {
  await runSeed();
});

async function createTestUser(firstName: string, lastName = 'Test'): Promise<User> {
  return prisma.user.create({
    data: { clerkUserId: `test_roster_${randomUUID()}`, email: `${randomUUID()}@example.com`, firstName, lastName },
  });
}

function authAdapterFor(user: User) {
  return createFakeAuthAdapter({
    acting: { clerkUserId: user.clerkUserId, email: user.email!, firstName: user.firstName, lastName: user.lastName, avatarUrl: null },
  });
}

async function deleteTestUser(userId: string): Promise<void> {
  await prisma.matchParticipant.deleteMany({ where: { userId } });
  await prisma.matchInvitation.deleteMany({ where: { OR: [{ invitedUserId: userId }, { invitedById: userId }] } });
  await prisma.playerAvailability.deleteMany({ where: { userSportProfile: { userId } } });
  await prisma.userSportProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

describe('GET /api/v1/matches/:matchId/participants', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
  });

  it('returns organizer, confirmed, pending and rejected, excluding the organizer from confirmed and cancelled invitations entirely', async () => {
    const confirmedPlayer = await createTestUser('Bruno');
    const pendingPlayer = await createTestUser('Carla');
    const rejectedPlayer = await createTestUser('Diego');
    const cancelledPlayer = await createTestUser('Elena');
    createdUserIds.push(confirmedPlayer.id, pendingPlayer.id, rejectedPlayer.id, cancelledPlayer.id);

    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [confirmedPlayer.id] });
    createdMatchIds.push(match.id);

    await prisma.matchInvitation.createMany({
      data: [
        { matchId: match.id, invitedUserId: pendingPlayer.id, invitedById: match.organizerUserId, status: 'PENDING' },
        { matchId: match.id, invitedUserId: rejectedPlayer.id, invitedById: match.organizerUserId, status: 'REJECTED', respondedAt: new Date() },
        { matchId: match.id, invitedUserId: cancelledPlayer.id, invitedById: match.organizerUserId, status: 'CANCELLED' },
      ],
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/participants`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: {
        organizer: { userId: string };
        confirmed: Array<{ userId: string }>;
        pending: Array<{ userId: string; invitationId: string }>;
        rejected: Array<{ userId: string; invitationId: string }>;
      };
    };

    expect(body.data.organizer.userId).toBe(SEED_IDS.users.juan);
    expect(body.data.confirmed.map((entry) => entry.userId)).toEqual([confirmedPlayer.id]);
    expect(body.data.confirmed.some((entry) => entry.userId === SEED_IDS.users.juan)).toBe(false);
    expect(body.data.pending.map((entry) => entry.userId)).toEqual([pendingPlayer.id]);
    expect(body.data.rejected.map((entry) => entry.userId)).toEqual([rejectedPlayer.id]);
    expect([...body.data.pending, ...body.data.rejected].some((entry) => entry.userId === cancelledPlayer.id)).toBe(false);

    await app.close();
  });

  it('includes a ratings summary, scoped to the match sport, for the organizer and every confirmed participant', async () => {
    const confirmedPlayer = await createTestUser('Bruno');
    createdUserIds.push(confirmedPlayer.id);

    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [confirmedPlayer.id],
      sportModalityId: SEED_IDS.modalities.football5,
    });
    createdMatchIds.push(match.id);

    await prisma.playerRating.create({
      data: { matchId: match.id, authorUserId: SEED_IDS.users.juan, targetUserId: confirmedPlayer.id, gameplayScore: 4, conductScore: 5, comment: 'Buen partido' },
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/participants`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: {
        organizer: { ratings: { sportId: string; gameplayAverage: number | null; conductAverage: number | null; count: number; commentsCount: number } };
        confirmed: Array<{ userId: string; ratings: { gameplayAverage: number | null; conductAverage: number | null; count: number; commentsCount: number } }>;
      };
    };

    const rated = body.data.confirmed.find((entry) => entry.userId === confirmedPlayer.id);
    expect(rated?.ratings).toEqual({
      sportId: SEED_IDS.sports.football,
      sportName: 'Fútbol',
      gameplayAverage: 4,
      conductAverage: 5,
      count: 1,
      commentsCount: 1,
    });

    // The organizer never received a rating in this test -- still gets a
    // real (empty, not missing) summary, same shape a candidate with no
    // ratings gets.
    expect(body.data.organizer.ratings).toMatchObject({ sportId: SEED_IDS.sports.football, count: 0, commentsCount: 0, gameplayAverage: null, conductAverage: null });

    await prisma.playerRating.deleteMany({ where: { matchId: match.id } });
    await app.close();
  });

  it('reflects a cancelled invitation disappearing from pending immediately', async () => {
    const invitedPlayer = await createTestUser('Fabricio');
    createdUserIds.push(invitedPlayer.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: invitedPlayer.id, invitedById: match.organizerUserId, status: 'PENDING' },
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });

    const before = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/participants`, headers: { authorization: 'Bearer juan' } });
    expect((before.json() as { data: { pending: unknown[] } }).data.pending).toHaveLength(1);

    const cancelResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${invitation.id}/cancel`,
      headers: { authorization: 'Bearer juan' },
    });
    expect(cancelResponse.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/participants`, headers: { authorization: 'Bearer juan' } });
    const afterBody = after.json() as { data: { pending: unknown[]; rejected: unknown[] } };
    expect(afterBody.data.pending).toHaveLength(0);
    expect(afterBody.data.rejected).toHaveLength(0);

    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/participants` });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 404 for a nonexistent match', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/matches/00000000-0000-0000-0000-000000000000/participants',
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('DELETE /api/v1/matches/:matchId/participants/:userId', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
  });

  it('lets the organizer remove a confirmed participant', async () => {
    const participant = await createTestUser('Gabriel');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [participant.id] });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/matches/${match.id}/participants/${participant.id}`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(204);
    const remaining = await prisma.matchParticipant.findUnique({ where: { matchId_userId: { matchId: match.id, userId: participant.id } } });
    expect(remaining).toBeNull();

    await app.close();
  });

  it('rejects removal attempted by someone other than the organizer', async () => {
    const participant = await createTestUser('Helena');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [participant.id] });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/matches/${match.id}/participants/${participant.id}`,
      headers: { authorization: 'Bearer martin' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NOT_ORGANIZER');

    await app.close();
  });

  it('prevents the organizer from removing themselves', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/matches/${match.id}/participants/${SEED_IDS.users.juan}`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CANNOT_REMOVE_ORGANIZER');

    await app.close();
  });

  it('returns 404 when the target is not a participant', async () => {
    const notAParticipant = await createTestUser('Ivan');
    createdUserIds.push(notAParticipant.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/matches/${match.id}/participants/${notAParticipant.id}`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PARTICIPANT_NOT_FOUND');

    await app.close();
  });

  it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const)('rejects removal when the match is %s', async (status) => {
    const participant = await createTestUser('Julieta');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [participant.id],
      status,
      endsAt: new Date(Date.now() - 3600_000),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/matches/${match.id}/participants/${participant.id}`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_NOT_EDITABLE');

    await app.close();
  });

  it('flips a FULL match back to ORGANIZING when removing a participant opens a spot, atomically', async () => {
    const participant = await createTestUser('Karina');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      maxPlayers: 2,
      participantUserIds: [participant.id],
      status: 'FULL',
      startsAt: new Date(Date.now() + 3600_000),
      endsAt: new Date(Date.now() + 7200_000),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/matches/${match.id}/participants/${participant.id}`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(204);
    const updatedMatch = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updatedMatch.status).toBe('ORGANIZING');
    const remainingParticipant = await prisma.matchParticipant.findUnique({ where: { matchId_userId: { matchId: match.id, userId: participant.id } } });
    expect(remainingParticipant).toBeNull();

    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'DELETE', url: `/api/v1/matches/${match.id}/participants/${SEED_IDS.users.martin}` });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('POST /api/v1/matches/:matchId/leave', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
  });

  it('lets a participant leave the match', async () => {
    const participant = await createTestUser('Leandro');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [participant.id] });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(participant) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/matches/${match.id}/leave`, headers: { authorization: 'Bearer acting' } });

    expect(response.statusCode).toBe(204);
    const remaining = await prisma.matchParticipant.findUnique({ where: { matchId_userId: { matchId: match.id, userId: participant.id } } });
    expect(remaining).toBeNull();

    await app.close();
  });

  it('prevents the organizer from leaving their own match', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'POST', url: `/api/v1/matches/${match.id}/leave`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('ORGANIZER_CANNOT_LEAVE');

    await app.close();
  });

  it('rejects leaving a match the user does not participate in', async () => {
    const outsider = await createTestUser('Miguel');
    createdUserIds.push(outsider.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(outsider) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/matches/${match.id}/leave`, headers: { authorization: 'Bearer acting' } });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('NOT_A_PARTICIPANT');

    await app.close();
  });

  it('rejects leaving once the match has already started', async () => {
    const participant = await createTestUser('Nadia');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [participant.id],
      status: 'IN_PROGRESS',
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(participant) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/matches/${match.id}/leave`, headers: { authorization: 'Bearer acting' } });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_NOT_EDITABLE');

    await app.close();
  });

  it('flips a FULL match back to ORGANIZING when a participant leaves and opens a spot', async () => {
    const participant = await createTestUser('Oscar');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      maxPlayers: 2,
      participantUserIds: [participant.id],
      status: 'FULL',
      startsAt: new Date(Date.now() + 3600_000),
      endsAt: new Date(Date.now() + 7200_000),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(participant) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/matches/${match.id}/leave`, headers: { authorization: 'Bearer acting' } });

    expect(response.statusCode).toBe(204);
    const updatedMatch = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updatedMatch.status).toBe('ORGANIZING');

    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'POST', url: `/api/v1/matches/${match.id}/leave` });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
