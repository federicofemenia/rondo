import type { Prisma } from '@prisma/client';
import type { CreateInvitationInputDto, MatchInvitationDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { displayName, getConfirmedParticipantIds, requireMatchWithRelations } from './matches.service.js';
import { getMatchCandidates } from './matching.service.js';
import { MatchServiceError } from './errors.js';

const invitationInclude = {
  match: { include: { club: true, sportModality: { include: { sport: true } }, organizer: true } },
  invitedUser: true,
} satisfies Prisma.MatchInvitationInclude;

type InvitationWithRelations = Prisma.MatchInvitationGetPayload<{ include: typeof invitationInclude }>;

function toInvitationDto(invitation: InvitationWithRelations): MatchInvitationDto {
  return {
    id: invitation.id,
    matchId: invitation.matchId,
    status: invitation.status,
    position: invitation.position,
    invitedUserId: invitation.invitedUserId,
    invitedUserDisplayName: displayName(invitation.invitedUser),
    invitedById: invitation.invitedById,
    organizerDisplayName: displayName(invitation.match.organizer),
    sportName: invitation.match.sportModality.sport.name,
    modalityName: invitation.match.sportModality.name,
    clubName: invitation.match.club?.name ?? null,
    scheduledDate: invitation.match.scheduledDate.toISOString().slice(0, 10),
    availabilityStartMinutes: invitation.match.availabilityStartMinutes,
    availabilityEndMinutes: invitation.match.availabilityEndMinutes,
    startsAt: invitation.match.startsAt ? invitation.match.startsAt.toISOString() : null,
    endsAt: invitation.match.endsAt ? invitation.match.endsAt.toISOString() : null,
    createdAt: invitation.createdAt.toISOString(),
    respondedAt: invitation.respondedAt ? invitation.respondedAt.toISOString() : null,
  };
}

async function requireInvitation(invitationId: string): Promise<InvitationWithRelations> {
  const invitation = await prisma.matchInvitation.findUnique({ where: { id: invitationId }, include: invitationInclude });
  if (!invitation) {
    throw new MatchServiceError(404, 'INVITATION_NOT_FOUND', 'La invitación no existe.');
  }
  return invitation;
}

/**
 * Resolves the position stored on the invitation. When the match has no
 * required positions, position is purely informational and left null. When
 * it does, an explicit request must be one of the positions the match needs
 * that the candidate can actually play; omitted, the first such position is
 * picked automatically. Matching already guarantees at least one overlap
 * exists for any valid candidate.
 */
function resolveInvitationPosition(requiredPositions: string[], candidatePositions: string[], requestedPosition?: string): string | null {
  if (requiredPositions.length === 0) {
    return null;
  }

  const compatible = requiredPositions.filter((position) => candidatePositions.includes(position));

  if (requestedPosition) {
    if (!compatible.includes(requestedPosition)) {
      throw new MatchServiceError(422, 'POSITION_NOT_COMPATIBLE', 'La posición indicada no es válida para este candidato y partido.');
    }
    return requestedPosition;
  }

  return compatible[0] ?? null;
}

export async function listMyInvitations(userId: string): Promise<MatchInvitationDto[]> {
  const invitations = await prisma.matchInvitation.findMany({
    where: { invitedUserId: userId },
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  });

  return invitations.map(toInvitationDto);
}

/**
 * Creates a real invitation. The eligibility check reuses getMatchCandidates
 * (the same deterministic matching used by CandidatesPage) rather than
 * re-implementing sport/position/availability/invitation-opt-in rules here.
 */
export async function createInvitation(
  matchId: string,
  organizerUserId: string,
  input: CreateInvitationInputDto,
  now: Date = new Date(),
): Promise<MatchInvitationDto> {
  const match = await requireMatchWithRelations(matchId, now);

  if (match.organizerUserId !== organizerUserId) {
    throw new MatchServiceError(403, 'NOT_ORGANIZER', 'Solo el organizador puede invitar jugadores.');
  }

  if (input.invitedUserId === organizerUserId) {
    throw new MatchServiceError(422, 'CANNOT_INVITE_SELF', 'No podés invitarte a vos mismo.');
  }

  const invitedUser = await prisma.user.findUnique({ where: { id: input.invitedUserId } });
  if (!invitedUser) {
    throw new MatchServiceError(404, 'USER_NOT_FOUND', 'El usuario indicado no existe.');
  }

  const participantIds = await getConfirmedParticipantIds(matchId);
  if (participantIds.has(input.invitedUserId)) {
    throw new MatchServiceError(422, 'ALREADY_PARTICIPANT', 'Ese jugador ya participa del partido.');
  }

  const existingInvitation = await prisma.matchInvitation.findUnique({
    where: { matchId_invitedUserId: { matchId, invitedUserId: input.invitedUserId } },
  });
  if (existingInvitation) {
    throw new MatchServiceError(409, 'INVITATION_ALREADY_EXISTS', 'Ya existe una invitación para este jugador en este partido.');
  }

  const candidates = await getMatchCandidates(matchId);
  const candidate = candidates.find((current) => current.id === input.invitedUserId);
  if (!candidate) {
    throw new MatchServiceError(422, 'NOT_A_VALID_CANDIDATE', 'Ese jugador no es un candidato válido para este partido.');
  }

  const position = resolveInvitationPosition(match.positions, candidate.positions, input.position);

  const created = await prisma.matchInvitation.create({
    data: {
      matchId,
      invitedUserId: input.invitedUserId,
      invitedById: organizerUserId,
      position,
      status: 'PENDING',
    },
  });

  return toInvitationDto(await requireInvitation(created.id));
}

/**
 * Accepting is transactional: the room check, participant creation, and the
 * ORGANIZING -> FULL transition all happen atomically so two concurrent
 * accepts on the last spot can never both succeed.
 */
export async function acceptInvitation(invitationId: string, actingUserId: string, now: Date = new Date()): Promise<MatchInvitationDto> {
  const invitation = await requireInvitation(invitationId);

  if (invitation.status !== 'PENDING') {
    throw new MatchServiceError(409, 'INVITATION_NOT_PENDING', 'Esta invitación ya fue respondida o cancelada.');
  }

  if (invitation.invitedUserId !== actingUserId) {
    throw new MatchServiceError(403, 'NOT_INVITED_USER', 'Solo el jugador invitado puede aceptar esta invitación.');
  }

  if (invitation.match.status !== 'ORGANIZING') {
    throw new MatchServiceError(409, 'MATCH_NOT_ACCEPTING_PARTICIPANTS', 'El partido ya no acepta nuevos participantes.');
  }

  await prisma.$transaction(async (tx) => {
    const participantsCount = await tx.matchParticipant.count({ where: { matchId: invitation.matchId } });
    if (participantsCount >= invitation.match.maxPlayers) {
      throw new MatchServiceError(409, 'MATCH_FULL', 'El partido ya no tiene lugares disponibles.');
    }

    await tx.matchParticipant.create({ data: { matchId: invitation.matchId, userId: actingUserId } });
    await tx.matchInvitation.update({ where: { id: invitationId }, data: { status: 'ACCEPTED', respondedAt: now } });

    const newCount = participantsCount + 1;
    if (newCount >= invitation.match.maxPlayers) {
      await tx.match.update({
        where: { id: invitation.matchId },
        data: { status: 'FULL', statusChangedAt: now, statusChangedByType: 'USER', statusChangedByUserId: actingUserId },
      });
    }
  });

  return toInvitationDto(await requireInvitation(invitationId));
}

export async function rejectInvitation(invitationId: string, actingUserId: string, now: Date = new Date()): Promise<MatchInvitationDto> {
  const invitation = await requireInvitation(invitationId);

  if (invitation.status !== 'PENDING') {
    throw new MatchServiceError(409, 'INVITATION_NOT_PENDING', 'Esta invitación ya fue respondida o cancelada.');
  }

  if (invitation.invitedUserId !== actingUserId) {
    throw new MatchServiceError(403, 'NOT_INVITED_USER', 'Solo el jugador invitado puede rechazar esta invitación.');
  }

  await prisma.matchInvitation.update({ where: { id: invitationId }, data: { status: 'REJECTED', respondedAt: now } });

  return toInvitationDto(await requireInvitation(invitationId));
}

export async function cancelInvitation(invitationId: string, actingUserId: string): Promise<MatchInvitationDto> {
  const invitation = await requireInvitation(invitationId);

  if (invitation.status !== 'PENDING') {
    throw new MatchServiceError(409, 'INVITATION_NOT_PENDING', 'Solo se pueden cancelar invitaciones pendientes.');
  }

  if (invitation.match.organizerUserId !== actingUserId) {
    throw new MatchServiceError(403, 'NOT_ORGANIZER', 'Solo el organizador puede cancelar esta invitación.');
  }

  await prisma.matchInvitation.update({ where: { id: invitationId }, data: { status: 'CANCELLED' } });

  return toInvitationDto(await requireInvitation(invitationId));
}
