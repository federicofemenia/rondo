import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@prisma/client';

const { sendNotificationMock, setVapidDetailsMock, FakeWebPushError } = vi.hoisted(() => {
  class FakeWebPushError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return { sendNotificationMock: vi.fn(), setVapidDetailsMock: vi.fn(), FakeWebPushError };
});

// Hoisted above every import below -- see push.controller.test.ts for why.
// Every push send in this file goes through this fake; never a real network call.
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
    WebPushError: FakeWebPushError,
  },
}));

import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { recordAndSendPushEvent } from '../../src/modules/push/pushEvents.service.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';
import { createFakeAuthAdapter } from '../support/fakeAuthAdapter.js';
import { createTestMatch, deleteTestMatch } from '../support/matchFactory.js';

const VAPID_ENV = { VAPID_PUBLIC_KEY: 'test-public-key', VAPID_PRIVATE_KEY: 'test-private-key', VAPID_SUBJECT: 'mailto:admin@rondo.app' };
const TEST_ENDPOINT_PREFIX = 'https://push.example.com/domain-events/';

function buildTestServer() {
  return buildServer({ NODE_ENV: 'test', ...VAPID_ENV }, { authAdapter: seedAuthAdapter });
}

/** Same seeded profiles as seedAuthAdapter, plus one ad-hoc "other" user -- for tests that need both a seeded actor (juan/martin/luciano/ana) and a freshly-created test user to authenticate in the same test. */
function buildTestServerWithExtraUser(user: User) {
  const adapter = createFakeAuthAdapter({
    juan: { clerkUserId: 'seed_juan_perez', email: 'juan.perez.seed@rondo.local', firstName: 'Juan', lastName: 'Pérez', avatarUrl: null },
    martin: { clerkUserId: 'seed_martin_gomez', email: 'martin.gomez.seed@rondo.local', firstName: 'Martín', lastName: 'Gómez', avatarUrl: null },
    luciano: { clerkUserId: 'seed_luciano_diaz', email: 'luciano.diaz.seed@rondo.local', firstName: 'Luciano', lastName: 'Díaz', avatarUrl: null },
    ana: { clerkUserId: 'seed_ana_torres', email: 'ana.torres.seed@rondo.local', firstName: 'Ana', lastName: 'Torres', avatarUrl: null },
    other: { clerkUserId: user.clerkUserId, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: null },
  });
  return buildServer({ NODE_ENV: 'test', ...VAPID_ENV }, { authAdapter: adapter });
}

async function givePushSubscription(userId: string): Promise<string> {
  const endpoint = `${TEST_ENDPOINT_PREFIX}${randomUUID()}`;
  await prisma.pushSubscription.create({ data: { userId, endpoint, p256dh: 'p256dh-value', auth: 'auth-value' } });
  return endpoint;
}

function calledEndpoints(): string[] {
  return (sendNotificationMock.mock.calls as [{ endpoint: string }, string][]).map(([subscription]) => subscription.endpoint);
}

function payloadsSentTo(endpoint: string): Record<string, unknown>[] {
  return (sendNotificationMock.mock.calls as [{ endpoint: string }, string][])
    .filter(([subscription]) => subscription.endpoint === endpoint)
    .map(([, body]) => JSON.parse(body) as Record<string, unknown>);
}

async function createTestUser(firstName: string, lastName = 'Test'): Promise<User> {
  return prisma.user.create({
    data: { clerkUserId: `test_push_domain_${randomUUID()}`, email: `${randomUUID()}@example.com`, firstName, lastName },
  });
}

async function deleteTestUser(userId: string): Promise<void> {
  await prisma.matchChatMessage.deleteMany({ where: { authorId: userId } });
  await prisma.matchParticipant.deleteMany({ where: { userId } });
  await prisma.matchInvitation.deleteMany({ where: { OR: [{ invitedUserId: userId }, { invitedById: userId }] } });
  await prisma.pushSubscription.deleteMany({ where: { userId } });
  const profiles = await prisma.userSportProfile.findMany({ where: { userId } });
  await prisma.playerAvailability.deleteMany({ where: { userSportProfileId: { in: profiles.map((profile) => profile.id) } } });
  await prisma.userSportProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

const createdMatchIds: string[] = [];
const createdUserIds: string[] = [];
const createdInvitationIds: string[] = [];

beforeAll(async () => {
  await runSeed();
});

beforeEach(async () => {
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: TEST_ENDPOINT_PREFIX } } });
});

afterEach(async () => {
  sendNotificationMock.mockReset();
  sendNotificationMock.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  setVapidDetailsMock.mockReset();
  await Promise.all(createdInvitationIds.splice(0).map((id) => prisma.matchInvitation.deleteMany({ where: { id } })));
  await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('MATCH_INVITATION_RECEIVED', () => {
  it('notifies the invited user, and not the organizer', async () => {
    const candidate = await createTestUser('Invitado');
    createdUserIds.push(candidate.id);
    const candidateProfile = await prisma.userSportProfile.create({
      data: { userId: candidate.id, sportId: SEED_IDS.sports.football, positions: [], isAvailableForInvitations: true },
    });
    // Available every day, all hours -- same "always available" backfill
    // real Clerk-synced accounts get (see ensureDefaultSportProfiles),
    // replicated by hand since this candidate is created directly.
    await Promise.all(
      [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) =>
        prisma.playerAvailability.create({
          data: { userSportProfileId: candidateProfile.id, dayOfWeek, startMinutes: 0, endMinutes: 1440 },
        }),
      ),
    );

    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status: 'ORGANIZING', startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);

    const candidateEndpoint = await givePushSubscription(candidate.id);
    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/invitations`,
      headers: { authorization: 'Bearer juan' },
      payload: { invitedUserId: candidate.id },
    });

    expect(response.statusCode).toBe(201);
    const invitationId = (response.json() as { data: { id: string } }).data.id;
    createdInvitationIds.push(invitationId);

    expect(calledEndpoints()).toContain(candidateEndpoint);
    expect(calledEndpoints()).not.toContain(organizerEndpoint);

    const [payload] = payloadsSentTo(candidateEndpoint);
    expect(payload!.title).toBe('Nueva invitación');
    expect((payload!.data as { invitationId: string }).invitationId).toBe(invitationId);

    await app.close();
  });
});

describe('invitation accept/reject push events', () => {
  it('accepting notifies the organizer, notifies other confirmed participants, but not the acceptor', async () => {
    const otherConfirmed = await createTestUser('Confirmado');
    createdUserIds.push(otherConfirmed.id);

    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, otherConfirmed.id],
      minPlayers: 2,
      maxPlayers: 10,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.martin, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);
    const otherConfirmedEndpoint = await givePushSubscription(otherConfirmed.id);
    const accepterEndpoint = await givePushSubscription(SEED_IDS.users.martin);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${invitation.id}/accept`,
      headers: { authorization: 'Bearer martin' },
    });

    expect(response.statusCode).toBe(200);

    const endpoints = calledEndpoints();
    expect(endpoints).toContain(organizerEndpoint);
    expect(endpoints).toContain(otherConfirmedEndpoint);
    expect(endpoints).not.toContain(accepterEndpoint);

    const [organizerPayload] = payloadsSentTo(organizerEndpoint);
    expect(organizerPayload!.title).toBe('Invitación aceptada');
    const [othersPayload] = payloadsSentTo(otherConfirmedEndpoint);
    expect(othersPayload!.title).toBe('Nuevo jugador confirmado');

    await app.close();
  });

  it('rejecting notifies the organizer and no one else', async () => {
    const otherConfirmed = await createTestUser('Confirmado');
    createdUserIds.push(otherConfirmed.id);

    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, otherConfirmed.id],
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.ana, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);
    const otherConfirmedEndpoint = await givePushSubscription(otherConfirmed.id);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${invitation.id}/reject`,
      headers: { authorization: 'Bearer ana' },
    });

    expect(response.statusCode).toBe(200);
    expect(calledEndpoints()).toContain(organizerEndpoint);
    expect(calledEndpoints()).not.toContain(otherConfirmedEndpoint);

    const [organizerPayload] = payloadsSentTo(organizerEndpoint);
    expect(organizerPayload!.title).toBe('Invitación rechazada');

    await app.close();
  });

  it('a push provider failure never reverts the accept operation', async () => {
    sendNotificationMock.mockRejectedValue(new Error('network blip'));

    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan],
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.martin, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);
    await givePushSubscription(SEED_IDS.users.juan);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${invitation.id}/accept`,
      headers: { authorization: 'Bearer martin' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { status: string } };
    expect(body.data.status).toBe('ACCEPTED');

    const participant = await prisma.matchParticipant.findUnique({
      where: { matchId_userId: { matchId: match.id, userId: SEED_IDS.users.martin } },
    });
    expect(participant).not.toBeNull();

    await app.close();
  });
});

describe('MATCH_FULL', () => {
  it('a real ORGANIZING -> FULL transition notifies every confirmed participant exactly once', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan],
      minPlayers: 1,
      maxPlayers: 2,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.martin, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);
    const newcomerEndpoint = await givePushSubscription(SEED_IDS.users.martin);

    const app = await buildTestServer();
    await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer martin' } });

    // Both the organizer and the just-accepted newcomer are "confirmed
    // participants" for MATCH_FULL's recipient list (unlike
    // MATCH_PARTICIPANT_JOINED, which excludes the acceptor) -- the
    // organizer additionally gets MATCH_INVITATION_ACCEPTED, so this counts
    // by payload title, not just by which endpoint was called.
    const organizerFullPushes = payloadsSentTo(organizerEndpoint).filter((payload) => payload.title === 'Equipo completo');
    const newcomerFullPushes = payloadsSentTo(newcomerEndpoint).filter((payload) => payload.title === 'Equipo completo');
    expect(organizerFullPushes).toHaveLength(1);
    expect(newcomerFullPushes).toHaveLength(1);

    await app.close();
  });

  it('reading an already-FULL match repeatedly never sends a second MATCH_FULL push', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan],
      minPlayers: 1,
      maxPlayers: 2,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);
    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.martin, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);
    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);

    const app = await buildTestServer();
    await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer martin' } });
    const fullCountAfterAccept = payloadsSentTo(organizerEndpoint).filter((payload) => payload.title === 'Equipo completo').length;
    expect(fullCountAfterAccept).toBe(1);

    // Reading the match repeatedly (lazy lifecycle resolution) must not
    // re-fire MATCH_FULL -- it's already FULL, there is no new transition.
    await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}`, headers: { authorization: 'Bearer juan' } });
    await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}`, headers: { authorization: 'Bearer juan' } });

    const fullCountAfterReads = payloadsSentTo(organizerEndpoint).filter((payload) => payload.title === 'Equipo completo').length;
    expect(fullCountAfterReads).toBe(1);

    await app.close();
  });

  it('a later real ORGANIZING -> FULL cycle (leave, then refill) notifies again', async () => {
    const other = await createTestUser('Sale y vuelve a llenarse');
    createdUserIds.push(other.id);

    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, other.id],
      minPlayers: 1,
      maxPlayers: 2,
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);
    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);

    // Already FULL from creation (2/2) -- force it there directly (bypasses
    // the accept flow, which already has its own dedicated test above) so
    // this test can focus purely on the leave-then-refill cycle.
    await prisma.match.update({ where: { id: match.id }, data: { status: 'FULL', statusChangedAt: new Date() } });

    const app = await buildTestServerWithExtraUser(other);

    // Leave -> drops back to ORGANIZING (see participants.service.ts).
    await app.inject({ method: 'POST', url: `/api/v1/matches/${match.id}/leave`, headers: { authorization: 'Bearer other' } });

    const invitation = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.luciano, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(invitation.id);

    await app.inject({ method: 'POST', url: `/api/v1/invitations/${invitation.id}/accept`, headers: { authorization: 'Bearer luciano' } });

    const fullCount = payloadsSentTo(organizerEndpoint).filter((payload) => payload.title === 'Equipo completo').length;
    expect(fullCount).toBe(1);

    await app.close();
  });
});

describe('MATCH_CANCELLED', () => {
  async function buildCancellableMatch() {
    const confirmed = await createTestUser('Confirmado');
    createdUserIds.push(confirmed.id);

    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, confirmed.id],
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const pending = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.martin, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(pending.id);
    const rejected = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.luciano, invitedById: SEED_IDS.users.juan, status: 'REJECTED', respondedAt: new Date() },
    });
    createdInvitationIds.push(rejected.id);

    return { match, confirmed };
  }

  it('notifies confirmed participants and pending invitees, but not rejected ones or the organizer who cancelled', async () => {
    const { match, confirmed } = await buildCancellableMatch();

    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);
    const confirmedEndpoint = await givePushSubscription(confirmed.id);
    const pendingEndpoint = await givePushSubscription(SEED_IDS.users.martin);
    const rejectedEndpoint = await givePushSubscription(SEED_IDS.users.luciano);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/cancellation`,
      headers: { authorization: 'Bearer juan' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const endpoints = calledEndpoints();
    expect(endpoints).toContain(confirmedEndpoint);
    expect(endpoints).toContain(pendingEndpoint);
    expect(endpoints).not.toContain(rejectedEndpoint);
    expect(endpoints).not.toContain(organizerEndpoint);

    const [payload] = payloadsSentTo(confirmedEndpoint);
    expect(payload!.title).toBe('Partido cancelado');

    await app.close();
  });

  it('only ever sends the cancellation push once for a given match', async () => {
    const { match, confirmed } = await buildCancellableMatch();
    const confirmedEndpoint = await givePushSubscription(confirmed.id);

    const app = await buildTestServer();
    await app.inject({ method: 'POST', url: `/api/v1/matches/${match.id}/cancellation`, headers: { authorization: 'Bearer juan' }, payload: {} });
    // A match that's already CANCELLED is no longer editable -- this second
    // attempt is rejected by assertMatchEditable before ever reaching the
    // push dispatch, so it's also a behavioral guarantee, not just dedupeKey.
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/cancellation`,
      headers: { authorization: 'Bearer juan' },
      payload: {},
    });

    expect(second.statusCode).toBe(409);
    expect(payloadsSentTo(confirmedEndpoint).filter((payload) => payload.title === 'Partido cancelado')).toHaveLength(1);

    const events = await prisma.pushEvent.count({ where: { type: 'MATCH_CANCELLED', aggregateId: match.id } });
    expect(events).toBe(1);

    await app.close();
  });
});

describe('MATCH_COMPLETED_RATINGS_ENABLED', () => {
  async function buildJustEndedMatch() {
    const confirmed = await createTestUser('Confirmado');
    createdUserIds.push(confirmed.id);

    const now = new Date();
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, confirmed.id],
      status: 'IN_PROGRESS',
      startsAt: new Date(now.getTime() - 2 * 3600_000),
      endsAt: new Date(now.getTime() - 3600_000),
    });
    createdMatchIds.push(match.id);

    return { match, confirmed };
  }

  it('notifies every confirmed participant exactly once when a match transitions to COMPLETED', async () => {
    const { match, confirmed } = await buildJustEndedMatch();
    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);
    const confirmedEndpoint = await givePushSubscription(confirmed.id);

    const app = await buildTestServer();
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { status: string } }).data.status).toBe('COMPLETED');
    expect(calledEndpoints()).toContain(organizerEndpoint);
    expect(calledEndpoints()).toContain(confirmedEndpoint);

    const [payload] = payloadsSentTo(organizerEndpoint);
    expect(payload!.title).toBe('Valoraciones habilitadas');

    await app.close();
  });

  it('never sends a second push for a match that is already COMPLETED, no matter how many times it is read', async () => {
    const { match } = await buildJustEndedMatch();
    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);

    const app = await buildTestServer();
    await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}`, headers: { authorization: 'Bearer juan' } });
    await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}`, headers: { authorization: 'Bearer juan' } });
    await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}`, headers: { authorization: 'Bearer juan' } });

    expect(payloadsSentTo(organizerEndpoint).filter((payload) => payload.title === 'Valoraciones habilitadas')).toHaveLength(1);

    await app.close();
  });
});

describe('MATCH_CHAT_MESSAGE', () => {
  async function buildChatMatch() {
    const confirmed = await createTestUser('Confirmado');
    createdUserIds.push(confirmed.id);
    const removed = await createTestUser('Removido');
    createdUserIds.push(removed.id);

    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, confirmed.id, removed.id],
      startsAt: null,
      endsAt: null,
    });
    createdMatchIds.push(match.id);

    const pending = await prisma.matchInvitation.create({
      data: { matchId: match.id, invitedUserId: SEED_IDS.users.martin, invitedById: SEED_IDS.users.juan, status: 'PENDING' },
    });
    createdInvitationIds.push(pending.id);

    return { match, confirmed, removed };
  }

  it('notifies every confirmed participant except the author', async () => {
    const { match, confirmed } = await buildChatMatch();
    const authorEndpoint = await givePushSubscription(SEED_IDS.users.juan);
    const confirmedEndpoint = await givePushSubscription(confirmed.id);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Buen partido a todos' },
    });

    expect(response.statusCode).toBe(201);
    expect(calledEndpoints()).toContain(confirmedEndpoint);
    expect(calledEndpoints()).not.toContain(authorEndpoint);

    const [payload] = payloadsSentTo(confirmedEndpoint);
    expect(payload!.title).toBe('Juan Pérez · Fútbol');
    expect(payload!.body).toBe('Buen partido a todos');

    await app.close();
  });

  it('does not notify a pending invitee, nor a removed former participant', async () => {
    const { match, removed } = await buildChatMatch();
    const pendingEndpoint = await givePushSubscription(SEED_IDS.users.martin);
    const removedEndpoint = await givePushSubscription(removed.id);

    const app = await buildTestServer();
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/matches/${match.id}/participants/${removed.id}`,
      headers: { authorization: 'Bearer juan' },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Hola equipo' },
    });

    expect(calledEndpoints()).not.toContain(pendingEndpoint);
    expect(calledEndpoints()).not.toContain(removedEndpoint);

    await app.close();
  });

  it('truncates a long message to a single-line preview with an ellipsis', async () => {
    const { match, confirmed } = await buildChatMatch();
    const confirmedEndpoint = await givePushSubscription(confirmed.id);

    const longMessage = `${'a'.repeat(120)}`;

    const app = await buildTestServer();
    await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: longMessage },
    });

    const [payload] = payloadsSentTo(confirmedEndpoint);
    expect((payload!.body as string).length).toBe(101);
    expect((payload!.body as string).endsWith('…')).toBe(true);

    await app.close();
  });

  it('each message generates its own distinct push event', async () => {
    const { match, confirmed } = await buildChatMatch();
    const confirmedEndpoint = await givePushSubscription(confirmed.id);

    const app = await buildTestServer();
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Mensaje uno' },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Mensaje dos' },
    });

    expect(payloadsSentTo(confirmedEndpoint)).toHaveLength(2);
    // aggregateId for a chat event is the *message* id, not the match id --
    // each message is its own aggregate/event, one PushEvent row apiece.
    const firstMessageId = (first.json() as { data: { id: string } }).data.id;
    const secondMessageId = (second.json() as { data: { id: string } }).data.id;
    const events = await prisma.pushEvent.count({
      where: { type: 'MATCH_CHAT_MESSAGE', aggregateId: { in: [firstMessageId, secondMessageId] } },
    });
    expect(events).toBe(2);

    await app.close();
  });

  it('a push failure never prevents the message from being saved', async () => {
    sendNotificationMock.mockRejectedValue(new Error('network blip'));
    const { match, confirmed } = await buildChatMatch();
    await givePushSubscription(confirmed.id);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Este mensaje debe guardarse' },
    });

    expect(response.statusCode).toBe(201);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
    });
    const messages = (list.json() as { data: { messages: Array<{ content: string }> } }).data.messages;
    expect(messages.some((message) => message.content === 'Este mensaje debe guardarse')).toBe(true);

    await app.close();
  });
});

describe('RATING_RECEIVED', () => {
  async function buildCompletedMatch() {
    const now = Date.now();
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      participantUserIds: [SEED_IDS.users.juan, SEED_IDS.users.martin, SEED_IDS.users.luciano],
      status: 'COMPLETED',
      endsAt: new Date(now - 2 * 3600_000),
      statusChangedAt: new Date(now - 2 * 3600_000),
    });
    createdMatchIds.push(match.id);
    return match;
  }

  it('notifies only the rated player, never the author', async () => {
    const match = await buildCompletedMatch();
    const authorEndpoint = await givePushSubscription(SEED_IDS.users.juan);
    const targetEndpoint = await givePushSubscription(SEED_IDS.users.martin);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 5, conductScore: 4, comment: 'Buen partido' },
    });

    expect(response.statusCode).toBe(200);
    expect(calledEndpoints()).toContain(targetEndpoint);
    expect(calledEndpoints()).not.toContain(authorEndpoint);

    const [payload] = payloadsSentTo(targetEndpoint);
    expect(payload!.title).toBe('Nueva valoración');
    expect(payload!.body).toBe('Recibiste una nueva valoración en Fútbol.');

    await app.close();
  });

  it('never includes the score, the comment, or the author identity in the payload', async () => {
    const match = await buildCompletedMatch();
    const targetEndpoint = await givePushSubscription(SEED_IDS.users.martin);
    const author = await prisma.user.findUniqueOrThrow({ where: { id: SEED_IDS.users.juan } });

    const app = await buildTestServer();
    await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 5, conductScore: 4, comment: 'Un comentario secreto que no debe viajar' },
    });

    // Checked on title/body specifically (not the whole raw payload) --
    // ratingId/tag are UUID-derived and legitimately contain arbitrary
    // digits, which would make a crude whole-payload digit search a false
    // positive.
    const [payload] = payloadsSentTo(targetEndpoint);
    const visibleText = `${payload!.title} ${payload!.body}`;
    expect(visibleText).not.toContain('Un comentario secreto');
    expect(visibleText).not.toMatch(/[0-9]/);
    expect(visibleText.toLowerCase()).not.toContain(author.firstName!.toLowerCase());
    expect(payload).not.toHaveProperty('data.gameplayScore');
    expect(payload).not.toHaveProperty('data.conductScore');
    expect(payload).not.toHaveProperty('data.comment');
    expect(payload).not.toHaveProperty('data.authorUserId');

    await app.close();
  });

  it('notifies the organizer when the organizer is the one being rated', async () => {
    const match = await buildCompletedMatch();
    const organizerEndpoint = await givePushSubscription(SEED_IDS.users.juan);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.juan}`,
      headers: { authorization: 'Bearer martin' },
      payload: { gameplayScore: 4, conductScore: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(calledEndpoints()).toContain(organizerEndpoint);

    await app.close();
  });

  it('editing an existing rating (same author, same target) never sends a second push', async () => {
    const match = await buildCompletedMatch();
    const targetEndpoint = await givePushSubscription(SEED_IDS.users.martin);

    const app = await buildTestServer();
    await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 3, conductScore: 3 },
    });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 5, conductScore: 5 },
    });

    expect(payloadsSentTo(targetEndpoint).filter((payload) => payload.title === 'Nueva valoración')).toHaveLength(1);

    const rating = await prisma.playerRating.findUniqueOrThrow({
      where: { matchId_authorUserId_targetUserId: { matchId: match.id, authorUserId: SEED_IDS.users.juan, targetUserId: SEED_IDS.users.martin } },
    });
    expect(rating.gameplayScore).toBe(5);

    const events = await prisma.pushEvent.count({ where: { type: 'RATING_RECEIVED', aggregateId: rating.id } });
    expect(events).toBe(1);

    await app.close();
  });

  it('a push failure never prevents the rating from being saved', async () => {
    sendNotificationMock.mockRejectedValue(new Error('network blip'));
    const match = await buildCompletedMatch();
    await givePushSubscription(SEED_IDS.users.martin);

    const app = await buildTestServer();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 5, conductScore: 5 },
    });

    expect(response.statusCode).toBe(200);
    const rating = await prisma.playerRating.findUnique({
      where: { matchId_authorUserId_targetUserId: { matchId: match.id, authorUserId: SEED_IDS.users.juan, targetUserId: SEED_IDS.users.martin } },
    });
    expect(rating).not.toBeNull();

    await app.close();
  });
});

describe('push outbox mechanics (recordAndSendPushEvent)', () => {
  it('delivers to every device a user has registered', async () => {
    const userId = SEED_IDS.users.ana;
    const endpointA = await givePushSubscription(userId);
    const endpointB = await givePushSubscription(userId);

    await recordAndSendPushEvent({
      type: 'MATCH_CHAT_MESSAGE',
      aggregateId: 'multi-device-test',
      dedupeKey: `multi-device-${randomUUID()}`,
      recipientUserIds: [userId],
      payload: { title: 'Rondo', body: 'hola', url: '/' },
    });

    const endpoints = calledEndpoints();
    expect(endpoints).toContain(endpointA);
    expect(endpoints).toContain(endpointB);
  });

  it('a failing device never aborts delivery to the user\'s other devices', async () => {
    const userId = SEED_IDS.users.ana;
    const failing = await givePushSubscription(userId);
    const working = await givePushSubscription(userId);

    sendNotificationMock.mockImplementation(async (subscription: { endpoint: string }) => {
      if (subscription.endpoint === failing) {
        throw new Error('device offline');
      }
      return { statusCode: 201, body: '', headers: {} };
    });

    await recordAndSendPushEvent({
      type: 'MATCH_CHAT_MESSAGE',
      aggregateId: 'partial-failure-test',
      dedupeKey: `partial-failure-${randomUUID()}`,
      recipientUserIds: [userId],
      payload: { title: 'Rondo', body: 'hola', url: '/' },
    });

    expect(calledEndpoints()).toContain(working);
  });

  it('the same dedupeKey is only ever recorded and sent once, even if called concurrently', async () => {
    const userId = SEED_IDS.users.ana;
    const endpoint = await givePushSubscription(userId);
    const dedupeKey = `dedupe-test-${randomUUID()}`;

    await Promise.all([
      recordAndSendPushEvent({
        type: 'MATCH_CHAT_MESSAGE',
        aggregateId: 'dedupe-test',
        dedupeKey,
        recipientUserIds: [userId],
        payload: { title: 'Rondo', body: 'hola', url: '/' },
      }),
      recordAndSendPushEvent({
        type: 'MATCH_CHAT_MESSAGE',
        aggregateId: 'dedupe-test',
        dedupeKey,
        recipientUserIds: [userId],
        payload: { title: 'Rondo', body: 'hola', url: '/' },
      }),
    ]);

    expect(payloadsSentTo(endpoint)).toHaveLength(1);
    const events = await prisma.pushEvent.count({ where: { dedupeKey } });
    expect(events).toBe(1);
  });

  it('never includes private information (email, username) in a sent payload', async () => {
    const { match, confirmed } = await (async () => {
      const confirmedUser = await createTestUser('Confirmado', 'Privado');
      createdUserIds.push(confirmedUser.id);
      const createdMatch = await createTestMatch({
        organizerUserId: SEED_IDS.users.juan,
        participantUserIds: [SEED_IDS.users.juan, confirmedUser.id],
        startsAt: null,
        endsAt: null,
      });
      createdMatchIds.push(createdMatch.id);
      return { match: createdMatch, confirmed: confirmedUser };
    })();

    const confirmedEndpoint = await givePushSubscription(confirmed.id);
    const organizer = await prisma.user.findUniqueOrThrow({ where: { id: SEED_IDS.users.juan } });

    const app = await buildTestServer();
    await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Hola' },
    });

    const raw = JSON.stringify(payloadsSentTo(confirmedEndpoint));
    expect(raw).not.toContain(organizer.email ?? '__no-email__');
    expect(raw.toLowerCase()).not.toContain('username');

    await app.close();
  });
});
