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

// Arbitrary fixed day so tests never depend on when they happen to run; only
// its derived day-of-week (via getUTCDay(), matching PlayerAvailability's
// convention) matters, never the actual date.
const TEST_DAY = new Date(Date.UTC(2026, 7, 1));
const TEST_DAY_OF_WEEK = TEST_DAY.getUTCDay();

async function createCandidateUser(firstName: string, lastName = 'Test'): Promise<User> {
  return prisma.user.create({
    data: { clerkUserId: `test_invitation_${randomUUID()}`, email: `${randomUUID()}@example.com`, firstName, lastName },
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
  await prisma.matchInvitation.deleteMany({ where: { OR: [{ invitedUserId: userId }, { invitedById: userId }] } });
  await prisma.matchParticipant.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

/** A compatible football candidate for a match scheduled on TEST_DAY with the given availability window, and no required positions. */
async function createCompatibleCandidate(firstName: string, windowStart = 14 * 60, windowEnd = 19 * 60): Promise<User> {
  const user = await createCandidateUser(firstName);
  const profile = await createSportProfile(user.id, SEED_IDS.sports.football);
  await addAvailability(profile.id, TEST_DAY_OF_WEEK, windowStart, windowEnd);
  return user;
}

async function deleteInvitation(invitationId: string): Promise<void> {
  await prisma.matchInvitation.deleteMany({ where: { id: invitationId } });
}

function authAdapterFor(user: User) {
  return createFakeAuthAdapter({
    candidate: { clerkUserId: user.clerkUserId, email: user.email!, firstName: user.firstName, lastName: user.lastName, avatarUrl: null },
  });
}

describe('POST /api/v1/matches/:matchId/invitations', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdInvitationIds.splice(0).map(deleteInvitation));
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteCandidateUser));
  });

  it('creates an invitation for a valid candidate', async () => {
    const candidate = await createCompatibleCandidate('Beltran');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: candidate.id },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: { id: string; status: string; position: string | null; invitedUserId: string } };
    createdInvitationIds.push(body.data.id);
    expect(body.data.status).toBe('PENDING');
    expect(body.data.position).toBeNull();
    expect(body.data.invitedUserId).toBe(candidate.id);

    await app.close();
  });

  it('resolves the position from the overlap between the match requirement and the candidate', async () => {
    const candidate = await createCandidateUser('Camilo');
    createdUserIds.push(candidate.id);
    const profile = await createSportProfile(candidate.id, SEED_IDS.sports.football, { positions: ['Arquero', 'Defensor'] });
    await addAvailability(profile.id, TEST_DAY_OF_WEEK, 14 * 60, 19 * 60);

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
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: candidate.id },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: { id: string; position: string | null } };
    createdInvitationIds.push(body.data.id);
    expect(body.data.position).toBe('Arquero');

    await app.close();
  });

  it('rejects a duplicate invitation for the same candidate', async () => {
    const candidate = await createCompatibleCandidate('Delfina');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: candidate.id },
    });
    createdInvitationIds.push((first.json() as { data: { id: string } }).data.id);

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: candidate.id },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('INVITATION_ALREADY_EXISTS');

    await app.close();
  });

  it('rejects inviting yourself', async () => {
    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: SEED_IDS.users.juan },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CANNOT_INVITE_SELF');

    await app.close();
  });

  it('rejects inviting an existing participant', async () => {
    const participant = await createCompatibleCandidate('Enzo');
    createdUserIds.push(participant.id);
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
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: participant.id },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('ALREADY_PARTICIPANT');

    await app.close();
  });

  it('rejects a candidate that does not pass the matching rules', async () => {
    const padelOnlyUser = await createCandidateUser('Fermin');
    createdUserIds.push(padelOnlyUser.id);
    const profile = await createSportProfile(padelOnlyUser.id, SEED_IDS.sports.padel);
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
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: padelOnlyUser.id },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('NOT_A_VALID_CANDIDATE');

    await app.close();
  });

  it('rejects a nonexistent invited user', async () => {
    const match = await createTestMatch({
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: '00000000-0000-0000-0000-000000000000' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('USER_NOT_FOUND');

    await app.close();
  });

  it('rejects invitations sent by someone other than the organizer', async () => {
    const candidate = await createCompatibleCandidate('Gonzalo');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      scheduledDate: TEST_DAY,
      availabilityStartMinutes: 14 * 60,
      availabilityEndMinutes: 19 * 60,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer martin' },
      payload: { invitedUserId: candidate.id },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NOT_ORGANIZER');

    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const match = await createTestMatch({ scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      payload: { invitedUserId: SEED_IDS.users.martin },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('GET /api/v1/me/invitations', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdInvitationIds.splice(0).map(deleteInvitation));
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteCandidateUser));
  });

  it('returns only invitations received by the authenticated user, most recent first', async () => {
    const recipient = await createCompatibleCandidate('Helena');
    const otherRecipient = await createCompatibleCandidate('Ines');
    createdUserIds.push(recipient.id, otherRecipient.id);

    const matchA = await createTestMatch({ scheduledDate: TEST_DAY, availabilityStartMinutes: 14 * 60, availabilityEndMinutes: 19 * 60, startsAt: null, endsAt: null });
    const matchB = await createTestMatch({ scheduledDate: TEST_DAY, availabilityStartMinutes: 14 * 60, availabilityEndMinutes: 19 * 60, startsAt: null, endsAt: null });
    createdMatchIds.push(matchA.id, matchB.id);

    const older = await prisma.matchInvitation.create({
      data: { matchId: matchA.id, invitedUserId: recipient.id, invitedById: SEED_IDS.users.juan, status: 'PENDING', createdAt: new Date(Date.now() - 60_000) },
    });
    const newer = await prisma.matchInvitation.create({
      data: { matchId: matchB.id, invitedUserId: recipient.id, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    const forSomeoneElse = await prisma.matchInvitation.create({
      data: { matchId: matchA.id, invitedUserId: otherRecipient.id, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(older.id, newer.id, forSomeoneElse.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(recipient) });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/invitations', headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ id: string; invitedUserId: string }> };
    expect(body.data.map((invitation) => invitation.id)).toEqual([newer.id, older.id]);
    expect(body.data.every((invitation) => invitation.invitedUserId === recipient.id)).toBe(true);

    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/invitations' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('POST /api/v1/invitations/:invitationId/accept', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdInvitationIds.splice(0).map(deleteInvitation));
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteCandidateUser));
  });

  it('accepts a pending invitation and creates a confirmed participant', async () => {
    const candidate = await createCompatibleCandidate('Julieta');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ maxPlayers: 10, scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(candidate) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { status: string; respondedAt: string | null } };
    expect(body.data.status).toBe('ACCEPTED');
    expect(body.data.respondedAt).not.toBeNull();

    const participant = await prisma.matchParticipant.findUnique({ where: { matchId_userId: { matchId: match.id, userId: candidate.id } } });
    expect(participant).not.toBeNull();

    await app.close();
  });

  it('transitions the match to FULL when accepting completes the roster', async () => {
    const candidate = await createCompatibleCandidate('Kevin');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ maxPlayers: 1, scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(candidate) });
    await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer candidate' } });

    const updatedMatch = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updatedMatch.status).toBe('FULL');

    await app.close();
  });

  it('rejects accepting when someone else already took the last spot', async () => {
    const filler = await createCandidateUser('Laura');
    const candidate = await createCompatibleCandidate('Manuel');
    createdUserIds.push(filler.id, candidate.id);
    const match = await createTestMatch({ maxPlayers: 1, scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    await prisma.matchParticipant.create({ data: { matchId: match.id, userId: filler.id } });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(candidate) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_FULL');

    await app.close();
  });

  it('rejects accepting on behalf of someone else', async () => {
    const candidate = await createCompatibleCandidate('Nadia');
    const impersonator = await createCandidateUser('Oscar');
    createdUserIds.push(candidate.id, impersonator.id);
    const match = await createTestMatch({ scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(impersonator) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NOT_INVITED_USER');

    await app.close();
  });

  it('rejects accepting an invitation that is not pending', async () => {
    const candidate = await createCompatibleCandidate('Patricia');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'CANCELLED' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(candidate) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('INVITATION_NOT_PENDING');

    await app.close();
  });

  it('rejects accepting when the match is no longer organizing', async () => {
    const candidate = await createCompatibleCandidate('Ramiro');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ status: 'CANCELLED', scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(candidate) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MATCH_NOT_ACCEPTING_PARTICIPANTS');

    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/00000000-0000-0000-0000-000000000000/accept` });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 404 for a nonexistent invitation', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/00000000-0000-0000-0000-000000000000/accept',
      headers: { authorization: 'Bearer juan' },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('POST /api/v1/invitations/:invitationId/reject', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdInvitationIds.splice(0).map(deleteInvitation));
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteCandidateUser));
  });

  it('rejects a pending invitation without creating a participant', async () => {
    const candidate = await createCompatibleCandidate('Sabrina');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(candidate) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/reject`, headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { status: string; respondedAt: string | null } };
    expect(body.data.status).toBe('REJECTED');
    expect(body.data.respondedAt).not.toBeNull();

    const participant = await prisma.matchParticipant.findUnique({ where: { matchId_userId: { matchId: match.id, userId: candidate.id } } });
    expect(participant).toBeNull();

    await app.close();
  });

  it('rejects rejecting on behalf of someone else', async () => {
    const candidate = await createCompatibleCandidate('Tomas');
    const impersonator = await createCandidateUser('Ursula');
    createdUserIds.push(candidate.id, impersonator.id);
    const match = await createTestMatch({ scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(impersonator) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/reject`, headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NOT_INVITED_USER');

    await app.close();
  });

  it('rejects rejecting an invitation twice', async () => {
    const candidate = await createCompatibleCandidate('Valeria');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: match.organizerUserId, status: 'REJECTED', respondedAt: new Date() },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(candidate) });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/reject`, headers: { authorization: 'Bearer candidate' } });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('INVITATION_NOT_PENDING');

    await app.close();
  });
});

describe('POST /api/v1/invitations/:invitationId/cancel', () => {
  const createdMatchIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdInvitationIds: string[] = [];

  afterEach(async () => {
    await Promise.all(createdInvitationIds.splice(0).map(deleteInvitation));
    await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
    await Promise.all(createdUserIds.splice(0).map(deleteCandidateUser));
  });

  it('lets the organizer cancel a pending invitation', async () => {
    const candidate = await createCompatibleCandidate('Walter');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/cancel`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { status: string } }).data.status).toBe('CANCELLED');

    await app.close();
  });

  it('rejects cancellation attempted by someone other than the organizer', async () => {
    const candidate = await createCompatibleCandidate('Ximena');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/cancel`, headers: { authorization: 'Bearer martin' } });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NOT_ORGANIZER');

    await app.close();
  });

  it('rejects cancelling an invitation that already got a response', async () => {
    const candidate = await createCompatibleCandidate('Yamila');
    createdUserIds.push(candidate.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, scheduledDate: TEST_DAY, startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: candidate.id, invitedById: SEED_IDS.users.juan, status: 'ACCEPTED', respondedAt: new Date() },
    });
    createdInvitationIds.push(invitation.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/cancel`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('INVITATION_NOT_PENDING');

    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'POST', url: '/api/v1/invitations/00000000-0000-0000-0000-000000000000/cancel' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
