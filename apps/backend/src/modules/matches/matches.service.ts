import { Prisma } from '@prisma/client';
import type { MatchStatus } from '@prisma/client';
import type { CreateMatchInputDto, MatchSummaryDto, UpdateMatchScheduleInputDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { matchCancelledPayload, matchCompletedRatingsEnabledPayload, toMatchPushContext } from '../push/pushCopy.js';
import { recordAndSendPushEvent } from '../push/pushEvents.service.js';
import { toArgentinaMinutesOfDay } from './argentinaTime.js';
import { applyMatchLifecycle, isVisibleOnHome } from './matchLifecycle.js';
import { MatchServiceError } from './errors.js';

// displayName is a users-domain concern; re-exported here since every
// match-related service (this file, invitations, participants, ratings,
// chat) already imports it from matches.service.js.
import { displayName } from '../users/users.service.js';
export { displayName };

const matchInclude = {
  club: true,
  sportModality: { include: { sport: true } },
  court: true,
  organizer: true,
  statusChangedByUser: true,
  _count: { select: { participants: true } },
} satisfies Prisma.MatchInclude;

export type MatchWithRelations = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

/**
 * Fires MATCH_COMPLETED_RATINGS_ENABLED exactly once per match, the moment
 * lifecycle resolution *itself* detects a real transition into COMPLETED --
 * called from every place that resolves lifecycle with full relations
 * (findMatchWithRelations, listUserMatches). During the beta this is the
 * only way COMPLETED gets detected: purely lazy, on whatever request
 * happens to read the match next -- there is deliberately no scheduled job
 * (see docs/WEB_PUSH.md). PushEvent's dedupeKey still guarantees a single
 * send even if two concurrent requests both observe the same transition.
 * Never fired for EXPIRED/IN_PROGRESS -- not in scope.
 */
async function notifyIfJustCompleted(match: MatchWithRelations, previousStatus: MatchStatus): Promise<void> {
  if (previousStatus === match.status || match.status !== 'COMPLETED') {
    return;
  }

  const participants = await prisma.matchParticipant.findMany({ where: { matchId: match.id }, select: { userId: true } });

  await recordAndSendPushEvent({
    type: 'MATCH_COMPLETED_RATINGS_ENABLED',
    aggregateId: match.id,
    dedupeKey: `match-completed-${match.id}`,
    recipientUserIds: participants.map((participant) => participant.userId),
    payload: matchCompletedRatingsEnabledPayload(toMatchPushContext(match)),
  });
}

export async function findMatchWithRelations(matchId: string, now: Date = new Date()): Promise<MatchWithRelations | null> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match) {
    return null;
  }
  const previousStatus = match.status;
  const resolved = await applyMatchLifecycle(match, match._count.participants, now);
  await notifyIfJustCompleted(resolved, previousStatus);
  return resolved;
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
    orderBy: [{ scheduledDate: 'asc' }, { startsAt: 'asc' }],
  });

  const resolved = await Promise.all(
    matches.map(async (match) => {
      const previousStatus = match.status;
      const next = await applyMatchLifecycle(match, match._count.participants, now);
      await notifyIfJustCompleted(next, previousStatus);
      return next;
    }),
  );
  return resolved.filter((match) => isVisibleOnHome(match, now));
}

/**
 * A match can be modified by its organizer only while it's ORGANIZING or
 * FULL. Both of those already imply it hasn't reached its start/expiry
 * instant yet (see matchLifecycle.ts's resolveMatchStatus): once that
 * instant passes, the match itself transitions to IN_PROGRESS/EXPIRED/
 * COMPLETED, so this check is only meaningful right after lifecycle has
 * been resolved with the same `now` -- every caller gets the match via
 * requireMatchWithRelations/findMatchWithRelations first, which always does.
 */
export function isMatchEditable(match: Pick<MatchWithRelations, 'status'>): boolean {
  return match.status === 'ORGANIZING' || match.status === 'FULL';
}

export function assertMatchEditable(match: Pick<MatchWithRelations, 'status'>): void {
  if (!isMatchEditable(match)) {
    throw new MatchServiceError(409, 'MATCH_NOT_EDITABLE', 'El partido ya comenzó, venció o finalizó y no puede modificarse.');
  }
}

export function toMatchSummaryDto(match: MatchWithRelations, currentUserId: string): MatchSummaryDto {
  return {
    id: match.id,
    status: match.status,
    clubId: match.clubId,
    clubName: match.club?.name ?? match.customVenueName ?? null,
    venueType: match.venueType,
    customVenueName: match.customVenueName,
    sportId: match.sportModality.sportId,
    sportModalityId: match.sportModalityId,
    sportName: match.sportModality.sport.name,
    modalityName: match.sportModality.name,
    courtName: match.court?.name ?? null,
    minPlayers: match.minPlayers,
    maxPlayers: match.maxPlayers,
    positions: match.positions,
    participantsCount: match._count.participants,
    scheduledDate: match.scheduledDate.toISOString().slice(0, 10),
    availabilityStartMinutes: match.availabilityStartMinutes,
    availabilityEndMinutes: match.availabilityEndMinutes,
    durationMinutes: match.durationMinutes,
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

type ResolvedSchedule = {
  scheduledDate: Date;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  durationMinutes: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

type ScheduleInput = {
  scheduledDate: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  durationMinutes: number;
  startsAt?: string | null;
};

/**
 * Computes the persisted schedule from a create/edit payload. The frontend
 * never sends endsAt: when a startsAt is chosen, endsAt is derived here from
 * the organizer-chosen durationMinutes (no longer the sport modality's fixed
 * duration), and duration-aware bounds (the confirmed time must both start
 * and end within the chosen availability window) are enforced here because
 * validating them requires this arithmetic, not just the payload's shape.
 */
function resolveSchedule(input: ScheduleInput): ResolvedSchedule {
  const scheduledDate = new Date(`${input.scheduledDate}T00:00:00.000Z`);

  if (!input.startsAt) {
    return {
      scheduledDate,
      availabilityStartMinutes: input.availabilityStartMinutes,
      availabilityEndMinutes: input.availabilityEndMinutes,
      durationMinutes: input.durationMinutes,
      startsAt: null,
      endsAt: null,
    };
  }

  const startsAt = new Date(input.startsAt);
  const startMinutes = toArgentinaMinutesOfDay(startsAt);
  const endMinutes = startMinutes + input.durationMinutes;
  if (endMinutes > input.availabilityEndMinutes) {
    throw new MatchServiceError(422, 'STARTS_AT_OUTSIDE_AVAILABILITY', 'El horario elegido no entra dentro de la franja disponible.');
  }

  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  return {
    scheduledDate,
    availabilityStartMinutes: input.availabilityStartMinutes,
    availabilityEndMinutes: input.availabilityEndMinutes,
    durationMinutes: input.durationMinutes,
    startsAt,
    endsAt,
  };
}

type VenueInput = {
  venueType: CreateMatchInputDto['venueType'];
  clubId?: string | null;
  customVenueName?: string | null;
};

async function assertClubExists(venueType: VenueInput['venueType'], clubId: string | null | undefined): Promise<void> {
  if (venueType === 'CLUB' && clubId) {
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      throw new MatchServiceError(422, 'CLUB_NOT_FOUND', 'El club indicado no existe.');
    }
  }
}

/** Same clubId/customVenueName-clearing rules as the venueType create/edit validation in @rondo/contracts, applied to the Prisma write. */
function resolveVenueData(input: VenueInput): { clubId: string | null; venueType: VenueInput['venueType']; customVenueName: string | null } {
  return {
    clubId: input.venueType === 'CLUB' ? (input.clubId ?? null) : null,
    venueType: input.venueType,
    customVenueName: input.venueType === 'CUSTOM' ? (input.customVenueName?.trim() ?? null) : null,
  };
}

export async function createMatch(organizerUserId: string, input: CreateMatchInputDto, now: Date = new Date()): Promise<MatchWithRelations> {
  const sportModality = await prisma.sportModality.findUnique({ where: { id: input.sportModalityId } });
  if (!sportModality) {
    throw new MatchServiceError(422, 'SPORT_MODALITY_NOT_FOUND', 'La modalidad deportiva indicada no existe.');
  }

  await assertClubExists(input.venueType, input.clubId);

  const schedule = resolveSchedule(input);

  const created = await prisma.match.create({
    data: {
      ...resolveVenueData(input),
      sportModalityId: input.sportModalityId,
      organizerUserId,
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      positions: input.positions ?? [],
      scheduledDate: schedule.scheduledDate,
      availabilityStartMinutes: schedule.availabilityStartMinutes,
      availabilityEndMinutes: schedule.availabilityEndMinutes,
      durationMinutes: schedule.durationMinutes,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      status: 'ORGANIZING',
      statusChangedAt: now,
      statusChangedByType: 'USER',
      statusChangedByUserId: organizerUserId,
      participants: { create: { userId: organizerUserId } },
    },
  });

  return requireMatchWithRelations(created.id, now);
}

export async function updateMatchSchedule(
  matchId: string,
  actingUserId: string,
  input: UpdateMatchScheduleInputDto,
  now: Date = new Date(),
): Promise<MatchWithRelations> {
  const match = await requireMatchWithRelations(matchId, now);

  assertMatchEditable(match);

  if (match.organizerUserId !== actingUserId) {
    throw new MatchServiceError(403, 'NOT_ORGANIZER', 'Solo el organizador puede editar el horario del partido.');
  }

  await assertClubExists(input.venueType, input.clubId);

  const schedule = resolveSchedule(input);

  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...resolveVenueData(input),
      scheduledDate: schedule.scheduledDate,
      availabilityStartMinutes: schedule.availabilityStartMinutes,
      availabilityEndMinutes: schedule.availabilityEndMinutes,
      durationMinutes: schedule.durationMinutes,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
    },
  });

  return requireMatchWithRelations(matchId, now);
}

export async function cancelMatch(matchId: string, actingUserId: string, reason: string | undefined, now: Date = new Date()): Promise<MatchWithRelations> {
  const match = await requireMatchWithRelations(matchId, now);

  assertMatchEditable(match);

  if (match.organizerUserId !== actingUserId) {
    throw new MatchServiceError(403, 'NOT_ORGANIZER', 'Solo el organizador puede cancelar el partido.');
  }

  const [confirmedParticipantIds, pendingInvitations] = await Promise.all([
    getConfirmedParticipantIds(matchId),
    prisma.matchInvitation.findMany({ where: { matchId, status: 'PENDING' }, select: { invitedUserId: true } }),
  ]);

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

  // Confirmed participants (organizer included, by construction -- see
  // createMatch) + still-pending invitees, minus whoever actually pulled
  // the trigger: the organizer already knows, having just done it.
  const recipientUserIds = new Set([...confirmedParticipantIds, ...pendingInvitations.map((invitation) => invitation.invitedUserId)]);
  recipientUserIds.delete(actingUserId);

  await recordAndSendPushEvent({
    type: 'MATCH_CANCELLED',
    aggregateId: matchId,
    dedupeKey: `match-cancelled-${matchId}`,
    recipientUserIds: [...recipientUserIds],
    payload: matchCancelledPayload(toMatchPushContext(match)),
  });

  return requireMatchWithRelations(matchId, now);
}

export async function getConfirmedParticipantIds(matchId: string): Promise<Set<string>> {
  const participants = await prisma.matchParticipant.findMany({ where: { matchId }, select: { userId: true } });
  return new Set(participants.map((participant) => participant.userId));
}

/**
 * Every user who already has an invitation row for this match, in any
 * status. `createInvitation` has a unique (matchId, invitedUserId)
 * constraint, so re-inviting is permanently blocked regardless of whether
 * the existing invitation is still PENDING or was ACCEPTED/REJECTED/
 * CANCELLED — the candidate list mirrors that same rule so it never offers
 * an "Invitar" action that would just fail.
 */
export async function getInvitedUserIds(matchId: string): Promise<Set<string>> {
  const invitations = await prisma.matchInvitation.findMany({ where: { matchId }, select: { invitedUserId: true } });
  return new Set(invitations.map((invitation) => invitation.invitedUserId));
}
