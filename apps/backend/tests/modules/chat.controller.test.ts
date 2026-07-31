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
    data: { clerkUserId: `test_chat_${randomUUID()}`, email: `${randomUUID()}@example.com`, firstName, lastName },
  });
}

function authAdapterFor(user: User) {
  return createFakeAuthAdapter({
    acting: { clerkUserId: user.clerkUserId, email: user.email!, firstName: user.firstName, lastName: user.lastName, avatarUrl: null },
  });
}

async function deleteTestUser(userId: string): Promise<void> {
  await prisma.matchChatMessage.deleteMany({ where: { authorId: userId } });
  await prisma.matchParticipant.deleteMany({ where: { userId } });
  await prisma.matchInvitation.deleteMany({ where: { OR: [{ invitedUserId: userId }, { invitedById: userId }] } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

const createdMatchIds: string[] = [];
const createdUserIds: string[] = [];

afterEach(async () => {
  await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
});

describe('GET /api/v1/matches/:matchId/chat/messages', () => {
  it('lets the organizer list messages', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.canSend).toBe(true);
    await app.close();
  });

  it('lets a confirmed participant list messages', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [SEED_IDS.users.martin] });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer martin' } });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('rejects an outside user with 403', async () => {
    const outsider = await createTestUser('Outsider');
    createdUserIds.push(outsider.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(outsider) });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer acting' } });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CHAT_ACCESS_DENIED');
    await app.close();
  });

  it('rejects a user with a pending invitation with 403', async () => {
    const invitee = await createTestUser('Invitee');
    createdUserIds.push(invitee.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);
    await prisma.matchInvitation.create({ data: { matchId: match.id, invitedUserId: invitee.id, invitedById: match.organizerUserId, status: 'PENDING' } });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(invitee) });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer acting' } });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CHAT_ACCESS_DENIED');
    await app.close();
  });

  it('rejects a removed participant with 403 immediately after removal', async () => {
    const removedUser = await createTestUser('Removed');
    createdUserIds.push(removedUser.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [removedUser.id] });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(removedUser) });
    const before = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer acting' } });
    expect(before.statusCode).toBe(200);

    await prisma.matchParticipant.delete({ where: { matchId_userId: { matchId: match.id, userId: removedUser.id } } });

    const after = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer acting' } });
    expect(after.statusCode).toBe(403);
    expect(after.json().error.code).toBe('CHAT_ACCESS_DENIED');
    await app.close();
  });

  it('returns messages ordered ascending by creation time, and keeps messages from a since-removed participant', async () => {
    const participant = await createTestUser('Historic');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [participant.id] });
    createdMatchIds.push(match.id);

    const now = Date.now();
    await prisma.matchChatMessage.createMany({
      data: [
        { matchId: match.id, authorId: match.organizerUserId, content: 'Primero', createdAt: new Date(now - 3000) },
        { matchId: match.id, authorId: participant.id, content: 'Segundo', createdAt: new Date(now - 2000) },
        { matchId: match.id, authorId: match.organizerUserId, content: 'Tercero', createdAt: new Date(now - 1000) },
      ],
    });

    await prisma.matchParticipant.delete({ where: { matchId_userId: { matchId: match.id, userId: participant.id } } });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { messages: Array<{ content: string; author: { displayName: string } }> } };
    expect(body.data.messages.map((message) => message.content)).toEqual(['Primero', 'Segundo', 'Tercero']);
    expect(body.data.messages[1]!.author.displayName).toContain('Historic');

    await app.close();
  });
});

describe('POST /api/v1/matches/:matchId/chat/messages', () => {
  it('lets the organizer send a message', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Hola equipo' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.content).toBe('Hola equipo');
    await app.close();
  });

  it('lets a confirmed participant send a message', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [SEED_IDS.users.martin] });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer martin' },
      payload: { content: 'Ahí llego' },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('rejects an empty message after trimming', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: '   ' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a message longer than 1000 characters', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'a'.repeat(1001) },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('resolves the author from authentication, ignoring any authorId sent in the body', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [SEED_IDS.users.martin] });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer martin' },
      payload: { content: 'Soy martin', authorId: SEED_IDS.users.juan },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.author.id).toBe(SEED_IDS.users.martin);
    expect(response.json().data.isCurrentUser).toBe(true);
    await app.close();
  });

  it('rejects sending from a non-participant with 403', async () => {
    const outsider = await createTestUser('Outsider');
    createdUserIds.push(outsider.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(outsider) });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer acting' },
      payload: { content: 'Hola' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CHAT_ACCESS_DENIED');
    await app.close();
  });

  it('does not allow sending once the match is CANCELLED', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status: 'CANCELLED', statusChangedAt: new Date() });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Hola' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CHAT_CLOSED');

    const listResponse = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer juan' } });
    expect(listResponse.json().data.closed).toBe(true);

    await app.close();
  });

  it('does not allow sending once the match is EXPIRED', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'EXPIRED',
      endsAt: new Date(Date.now() - 3600_000),
      statusChangedAt: new Date(),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Hola' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CHAT_CLOSED');
    await app.close();
  });

  it('allows sending for a match completed within the last 24 hours', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'COMPLETED',
      endsAt: new Date(Date.now() - 2 * 3600_000),
      statusChangedAt: new Date(Date.now() - 2 * 3600_000),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Buen partido' },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('does not allow sending for a match completed more than 24 hours ago', async () => {
    const match = await createTestMatch({
      organizerUserId: SEED_IDS.users.juan,
      status: 'COMPLETED',
      endsAt: new Date(Date.now() - 30 * 3600_000),
      statusChangedAt: new Date(Date.now() - 30 * 3600_000),
    });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Llegué tarde' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CHAT_CLOSED');

    const listResponse = await app.inject({ method: 'GET', url: `/api/v1/matches/${match.id}/chat/messages`, headers: { authorization: 'Bearer juan' } });
    expect(listResponse.json().data.closed).toBe(true);
    expect(listResponse.json().data.canSend).toBe(false);

    await app.close();
  });

  it('allows sending for an ORGANIZING match with no confirmed time yet', async () => {
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, status: 'ORGANIZING', startsAt: null, endsAt: null });
    createdMatchIds.push(match.id);

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer juan' },
      payload: { content: 'Todavía coordinando el horario' },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('rejects sending once a participant has left or been removed', async () => {
    const participant = await createTestUser('Leaving');
    createdUserIds.push(participant.id);
    const match = await createTestMatch({ organizerUserId: SEED_IDS.users.juan, participantUserIds: [participant.id] });
    createdMatchIds.push(match.id);

    await prisma.matchParticipant.delete({ where: { matchId_userId: { matchId: match.id, userId: participant.id } } });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: authAdapterFor(participant) });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/matches/${match.id}/chat/messages`,
      headers: { authorization: 'Bearer acting' },
      payload: { content: 'Ya no participo' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CHAT_ACCESS_DENIED');
    await app.close();
  });
});
