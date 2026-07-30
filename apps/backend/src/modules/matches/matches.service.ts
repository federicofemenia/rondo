import { Prisma } from '@prisma/client';
import type { CreateMatchInputDto, MatchSummaryDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { applyMatchLifecycle, isVisibleOnHome } from './matchLifecycle.js';
import { MatchServiceError } from './errors.js';

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'EXPIRED'] as const;

const matchInclude = {
  club: true,
  sportModality: { include: { sport: true } },
  court: true,
  organizer: true,
  statusChangedByUser: true,
  _count: { select: { participants: true } },
} satisfies Prisma.MatchInclude;

export type MatchWithRelations = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

export function displayName(user: { firstName: string | null; lastName: string | null; email: string }): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email;
}

export async function findMatchWithRelations(matchId: string, now: Date = new Date()): Promise<MatchWithRelations | null> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match) {
    return null;
  }
  return applyMatchLifecycle(match, now);
}

export async function requireMatchWithRelations(matchId: string, now: Date = new Date()): Promise<MatchWithRelations> {
  const match = await findMatchWithRelations(matchId, now);
  if (!match) {
    throw new MatchServiceError(404, 'MATCH_NOT_FOUND', 'El partido no existe.');
  }
  return match;
}

export async function listUserMatches(userId: string, now: Date = new Date()): Promise<MatchWithRelations[]> {
  const matches = await prisma.match.findMany({
    where: { OR: [{ organizerUserId: userId }, { participants: { some: { userId } } }] },
    include: matchInclude,
    orderBy: { startsAt: 'asc' },
  });

  const resolved = await Promise.all(matches.map((match) => applyMatchLifecycle(match, now)));
  return resolved.filter((match) => isVisibleOnHome(match, now));
}

export function toMatchSummaryDto(match: MatchWithRelations, currentUserId: string): MatchSummaryDto {
  return {
    id: match.id,
    status: match.status,
    clubId: match.clubId,
    clubName: match.club?.name ?? null,
    sportModalityId: match.sportModalityId,
    sportName: match.sportModality.sport.name,
    modalityName: match.sportModality.name,
    courtName: match.court?.name ?? null,
    minPlayers: match.minPlayers,
    maxPlayers: match.maxPlayers,
    positions: match.positions,
    participantsCount: match._count.participants,
    startsAt: match.startsAt ? match.startsAt.toISOString() : null,
    endsAt: match.endsAt ? match.endsAt.toISOString() : null,
    organizerUserId: match.organizerUserId,
    organizerDisplayName: displayName(match.organizer),
    isOrganizer: match.organizerUserId === currentUserId,
    createdAt: match.createdAt.toISOString(),
    statusChangedAt: match.statusChangedAt.toISOString(),
    statusChangedByType: match.statusChangedByType,
    statusChangedByUser: match.statusChangedByUser
      ? { id: match.statusChangedByUser.id, displayName: displayName(match.statusChangedByUser) }
      : null,
    cancellationReason: match.cancellationReason,
  };
}

export async function createMatch(organizerUserId: string, input: CreateMatchInputDto, now: Date = new Date()): Promise<MatchWithRelations> {
  const sportModality = await prisma.sportModality.findUnique({ where: { id: input.sportModalityId } });
  if (!sportModality) {
    throw new MatchServiceError(422, 'SPORT_MODALITY_NOT_FOUND', 'La modalidad deportiva indicada no existe.');
  }

  if (input.clubId) {
    const club = await prisma.club.findUnique({ where: { id: input.clubId } });
    if (!club) {
      throw new MatchServiceError(422, 'CLUB_NOT_FOUND', 'El club indicado no existe.');
    }
  }

  const created = await prisma.match.create({
    data: {
      clubId: input.clubId ?? null,
      sportModalityId: input.sportModalityId,
      organizerUserId,
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      positions: input.positions ?? [],
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      status: 'ORGANIZING',
      statusChangedAt: now,
      statusChangedByType: 'USER',
      statusChangedByUserId: organizerUserId,
      participants: { create: { userId: organizerUserId } },
    },
  });

  return requireMatchWithRelations(created.id, now);
}

export async function cancelMatch(matchId: string, actingUserId: string, reason: string | undefined, now: Date = new Date()): Promise<MatchWithRelations> {
  const match = await requireMatchWithRelations(matchId, now);

  if (TERMINAL_STATUSES.includes(match.status as (typeof TERMINAL_STATUSES)[number])) {
    throw new MatchServiceError(409, 'MATCH_ALREADY_FINAL', 'El partido ya está en un estado final y no puede cancelarse.');
  }

  if (match.organizerUserId !== actingUserId) {
    throw new MatchServiceError(403, 'NOT_ORGANIZER', 'Solo el organizador puede cancelar el partido.');
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'CANCELLED',
      statusChangedAt: now,
      statusChangedByType: 'USER',
      statusChangedByUserId: actingUserId,
      cancellationReason: reason ?? null,
    },
  });

  return requireMatchWithRelations(matchId, now);
}

export async function getConfirmedParticipantIds(matchId: string): Promise<Set<string>> {
  const participants = await prisma.matchParticipant.findMany({ where: { matchId }, select: { userId: true } });
  return new Set(participants.map((participant) => participant.userId));
}
