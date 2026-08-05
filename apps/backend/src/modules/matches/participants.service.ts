import type { MatchParticipantsResponseDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { emptyRatingsSummary, getRatingsSummaries } from './ratings.service.js';
import { assertMatchEditable, displayName, requireMatchWithRelations } from './matches.service.js';
import { MatchServiceError } from './errors.js';

/**
 * Full roster for the Jugadores tab: organizer first, then confirmed
 * participants (organizer excluded — it already has its own section),
 * pending invitations, and rejected invitations. Cancelled invitations are
 * intentionally left out: once cancelled they are no longer part of the
 * active roster the organizer manages.
 *
 * Organizer and confirmed participants also carry their ratings summary for
 * this match's sport (same one grouped query getRatingsSummaries always
 * uses -- never one query per player), so the Jugadores tab can show
 * stars/comments inline the same way Candidatos already does. Pending and
 * rejected invitees never played, so they carry no ratings.
 */
export async function getMatchParticipants(matchId: string): Promise<MatchParticipantsResponseDto> {
  const match = await requireMatchWithRelations(matchId);

  const [participants, invitations] = await Promise.all([
    prisma.matchParticipant.findMany({ where: { matchId }, include: { user: true }, orderBy: { confirmedAt: 'asc' } }),
    prisma.matchInvitation.findMany({
      where: { matchId, status: { in: ['PENDING', 'REJECTED'] } },
      include: { invitedUser: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const sport = { id: match.sportModality.sport.id, name: match.sportModality.sport.name };
  const ratingsByUserId = await getRatingsSummaries(participants.map((participant) => participant.userId), sport);

  const confirmed = participants
    .filter((participant) => participant.userId !== match.organizerUserId)
    .map((participant) => ({
      userId: participant.userId,
      displayName: displayName(participant.user),
      avatarUrl: participant.user.avatarUrl,
      ratings: ratingsByUserId.get(participant.userId) ?? emptyRatingsSummary(sport),
    }));

  const pending = invitations
    .filter((invitation) => invitation.status === 'PENDING')
    .map((invitation) => ({
      invitationId: invitation.id,
      userId: invitation.invitedUserId,
      displayName: displayName(invitation.invitedUser),
      avatarUrl: invitation.invitedUser.avatarUrl,
      position: invitation.position,
      createdAt: invitation.createdAt.toISOString(),
    }));

  const rejected = invitations
    .filter((invitation) => invitation.status === 'REJECTED')
    .map((invitation) => ({
      invitationId: invitation.id,
      userId: invitation.invitedUserId,
      displayName: displayName(invitation.invitedUser),
      avatarUrl: invitation.invitedUser.avatarUrl,
      respondedAt: invitation.respondedAt ? invitation.respondedAt.toISOString() : null,
    }));

  return {
    organizer: {
      userId: match.organizerUserId,
      displayName: displayName(match.organizer),
      avatarUrl: match.organizer.avatarUrl,
      ratings: ratingsByUserId.get(match.organizerUserId) ?? emptyRatingsSummary(sport),
    },
    confirmed,
    pending,
    rejected,
  };
}

/**
 * Shared by removeParticipant and leaveMatch: deletes the participant row
 * and, if the match had been FULL, recomputes whether a spot opened up and
 * drops it back to ORGANIZING. Transactional so the delete and the status
 * flip are atomic.
 */
async function removeParticipantRow(
  matchId: string,
  participantId: string,
  wasFull: boolean,
  maxPlayers: number,
  changedByUserId: string,
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.matchParticipant.delete({ where: { id: participantId } });

    if (wasFull) {
      const remaining = await tx.matchParticipant.count({ where: { matchId } });
      if (remaining < maxPlayers) {
        await tx.match.update({
          where: { id: matchId },
          data: { status: 'ORGANIZING', statusChangedAt: now, statusChangedByType: 'USER', statusChangedByUserId: changedByUserId },
        });
      }
    }
  });
}

export async function removeParticipant(
  matchId: string,
  organizerUserId: string,
  targetUserId: string,
  now: Date = new Date(),
): Promise<void> {
  const match = await requireMatchWithRelations(matchId);

  if (match.organizerUserId !== organizerUserId) {
    throw new MatchServiceError(403, 'NOT_ORGANIZER', 'Solo el organizador puede quitar jugadores.');
  }

  if (targetUserId === organizerUserId) {
    throw new MatchServiceError(422, 'CANNOT_REMOVE_ORGANIZER', 'El organizador no puede quitarse a sí mismo.');
  }

  assertMatchEditable(match);

  const participant = await prisma.matchParticipant.findUnique({ where: { matchId_userId: { matchId, userId: targetUserId } } });
  if (!participant) {
    throw new MatchServiceError(404, 'PARTICIPANT_NOT_FOUND', 'Ese jugador no participa del partido.');
  }

  await removeParticipantRow(matchId, participant.id, match.status === 'FULL', match.maxPlayers, organizerUserId, now);
}

export async function leaveMatch(matchId: string, actingUserId: string, now: Date = new Date()): Promise<void> {
  const match = await requireMatchWithRelations(matchId);

  if (match.organizerUserId === actingUserId) {
    throw new MatchServiceError(422, 'ORGANIZER_CANNOT_LEAVE', 'El organizador no puede abandonar su propio partido.');
  }

  assertMatchEditable(match);

  const participant = await prisma.matchParticipant.findUnique({ where: { matchId_userId: { matchId, userId: actingUserId } } });
  if (!participant) {
    throw new MatchServiceError(422, 'NOT_A_PARTICIPANT', 'No participás de este partido.');
  }

  await removeParticipantRow(matchId, participant.id, match.status === 'FULL', match.maxPlayers, actingUserId, now);
}
