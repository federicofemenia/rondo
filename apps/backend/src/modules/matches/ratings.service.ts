import type { MatchRatingsResponseDto, RateParticipantInputDto, RatingDto, RatingsParticipantDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { isRatingsEnabled, isRatingsOpen, ratingsCloseAt } from './matchLifecycle.js';
import { displayName, getConfirmedParticipantIds, requireMatchWithRelations } from './matches.service.js';
import { MatchServiceError } from './errors.js';

function toRatingDto(rating: {
  id: string;
  gameplayScore: number;
  conductScore: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RatingDto {
  return {
    id: rating.id,
    gameplayScore: rating.gameplayScore,
    conductScore: rating.conductScore,
    comment: rating.comment,
    createdAt: rating.createdAt.toISOString(),
    updatedAt: rating.updatedAt.toISOString(),
  };
}

export async function getMatchRatings(matchId: string, currentUserId: string, now: Date = new Date()): Promise<MatchRatingsResponseDto> {
  const match = await requireMatchWithRelations(matchId, now);

  const participantIds = await getConfirmedParticipantIds(matchId);
  const participantUsers = participantIds.size > 0 ? await prisma.user.findMany({ where: { id: { in: [...participantIds] } } }) : [];
  const ratingsGiven = await prisma.playerRating.findMany({ where: { matchId, authorUserId: currentUserId } });
  const ratingsByTarget = new Map(ratingsGiven.map((rating) => [rating.targetUserId, rating]));

  const enabled = isRatingsEnabled(match);
  const open = isRatingsOpen(match, now);

  const participants: RatingsParticipantDto[] = participantUsers
    .map((user) => {
      const isCurrentUser = user.id === currentUserId;
      const rating = ratingsByTarget.get(user.id) ?? null;
      const status: RatingsParticipantDto['status'] = isCurrentUser ? 'SELF' : rating ? 'COMPLETED' : 'PENDING';

      return {
        userId: user.id,
        displayName: displayName(user),
        avatarUrl: user.avatarUrl,
        isCurrentUser,
        status,
        rating: rating ? toRatingDto(rating) : null,
      } satisfies RatingsParticipantDto;
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const pendingCount = enabled && open ? participants.filter((participant) => participant.status === 'PENDING').length : 0;

  return {
    matchId,
    enabled,
    closed: enabled && !open,
    // ratingsCloseAt requires endsAt, which is only guaranteed once the match is
    // COMPLETED (the only status reachable through the timed endsAt transition).
    closeAt: enabled ? ratingsCloseAt(match)!.toISOString() : null,
    pendingCount,
    participants,
  };
}

export async function rateParticipant(
  matchId: string,
  authorUserId: string,
  targetUserId: string,
  input: RateParticipantInputDto,
  now: Date = new Date(),
): Promise<RatingDto> {
  if (authorUserId === targetUserId) {
    throw new MatchServiceError(422, 'CANNOT_RATE_SELF', 'No podés valorarte a vos mismo.');
  }

  const match = await requireMatchWithRelations(matchId, now);

  if (!isRatingsEnabled(match)) {
    throw new MatchServiceError(422, 'RATINGS_NOT_ENABLED', 'Las valoraciones se habilitarán cuando finalice el partido.');
  }

  if (!isRatingsOpen(match, now)) {
    throw new MatchServiceError(422, 'RATINGS_CLOSED', 'El período para valorar este partido finalizó.');
  }

  const participantIds = await getConfirmedParticipantIds(matchId);

  if (!participantIds.has(authorUserId)) {
    throw new MatchServiceError(403, 'NOT_A_PARTICIPANT', 'Solo los participantes confirmados del partido pueden valorar.');
  }

  if (!participantIds.has(targetUserId)) {
    throw new MatchServiceError(422, 'TARGET_NOT_A_PARTICIPANT', 'Solo podés valorar a participantes confirmados de este partido.');
  }

  const rating = await prisma.playerRating.upsert({
    where: { matchId_authorUserId_targetUserId: { matchId, authorUserId, targetUserId } },
    update: { gameplayScore: input.gameplayScore, conductScore: input.conductScore, comment: input.comment ?? null },
    create: {
      matchId,
      authorUserId,
      targetUserId,
      gameplayScore: input.gameplayScore,
      conductScore: input.conductScore,
      comment: input.comment ?? null,
    },
  });

  return toRatingDto(rating);
}
