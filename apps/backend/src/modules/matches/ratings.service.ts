import type {
  MatchRatingsResponseDto,
  RateParticipantInputDto,
  RatingCommentDto,
  RatingDto,
  RatingsParticipantDto,
  RatingsSummaryDto,
} from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { ratingReceivedPayload } from '../push/pushCopy.js';
import { recordAndSendPushEvent } from '../push/pushEvents.service.js';
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

  // Only the rated player -- never the author, never the organizer unless
  // they're the one rated, never other participants. dedupeKey is the same
  // rating.id whether this was a create or an update (same composite
  // unique key), so re-rating (editing a score/comment) never re-notifies:
  // only the first "you received a rating" send goes out. Score, comment
  // and the author's identity are deliberately never in the payload -- see
  // docs/WEB_PUSH.md.
  await recordAndSendPushEvent({
    type: 'RATING_RECEIVED',
    aggregateId: rating.id,
    dedupeKey: `rating-received-${rating.id}`,
    recipientUserIds: [targetUserId],
    payload: ratingReceivedPayload(match.id, match.sportModality.sport.name, rating.id),
  });

  return toRatingDto(rating);
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export type SportRef = { id: string; name: string };

export function emptyRatingsSummary(sport: SportRef): RatingsSummaryDto {
  return { sportId: sport.id, sportName: sport.name, gameplayAverage: null, conductAverage: null, count: 0, commentsCount: 0 };
}

/**
 * Two grouped queries total (never one per user): one for the score
 * averages/count, one for how many of those ratings carry actual written
 * text -- same "has real text" rule as getRatingComments below. Used by the
 * candidates list (all candidates at once) and the public profile (a
 * single-element list) alike, so neither ever N+1s.
 *
 * Both queries are scoped to `sport` via the rating's match -- a rating
 * only ever reflects how someone played in ONE match, which belongs to
 * exactly one sport, so mixing sports into a single average would be
 * meaningless (and misleading: a padel-only player would look "unrated"
 * or oddly-rated on a football candidates list otherwise).
 */
export async function getRatingsSummaries(userIds: string[], sport: SportRef): Promise<Map<string, RatingsSummaryDto>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const sportFilter = { match: { sportModality: { sportId: sport.id } } };

  const [grouped, commentGroups] = await Promise.all([
    prisma.playerRating.groupBy({
      by: ['targetUserId'],
      where: { targetUserId: { in: userIds }, ...sportFilter },
      _avg: { gameplayScore: true, conductScore: true },
      _count: { _all: true },
    }),
    prisma.playerRating.groupBy({
      by: ['targetUserId'],
      where: { targetUserId: { in: userIds }, AND: [{ comment: { not: null } }, { comment: { not: '' } }], ...sportFilter },
      _count: { _all: true },
    }),
  ]);

  const commentsCounts = new Map(commentGroups.map((group) => [group.targetUserId, group._count._all]));

  const summaries = new Map<string, RatingsSummaryDto>();
  for (const group of grouped) {
    summaries.set(group.targetUserId, {
      sportId: sport.id,
      sportName: sport.name,
      gameplayAverage: group._avg.gameplayScore !== null ? roundToOneDecimal(group._avg.gameplayScore) : null,
      conductAverage: group._avg.conductScore !== null ? roundToOneDecimal(group._avg.conductScore) : null,
      count: group._count._all,
      commentsCount: commentsCounts.get(group.targetUserId) ?? 0,
    });
  }
  return summaries;
}

export async function getRatingsSummary(userId: string, sport: SportRef): Promise<RatingsSummaryDto> {
  const summaries = await getRatingsSummaries([userId], sport);
  return summaries.get(userId) ?? emptyRatingsSummary(sport);
}

const MAX_RATING_COMMENTS = 20;

function toRatingCommentDto(rating: {
  id: string;
  gameplayScore: number;
  conductScore: number;
  comment: string | null;
  createdAt: Date;
  author: { displayName: string | null; firstName: string | null; lastName: string | null; username: string | null; email: string | null };
  match: { sportModality: { name: string; sport: { name: string } } };
}): RatingCommentDto {
  return {
    id: rating.id,
    authorDisplayName: displayName(rating.author),
    gameplayScore: rating.gameplayScore,
    conductScore: rating.conductScore,
    // Guaranteed non-null/non-empty by the query's where clause below.
    comment: rating.comment!,
    sportName: rating.match.sportModality.sport.name,
    modalityName: rating.match.sportModality.name,
    createdAt: rating.createdAt.toISOString(),
  };
}

/**
 * Most recent MAX_RATING_COMMENTS ratings that actually carry written
 * feedback for this user *in this sport*, newest first -- comments from a
 * different sport's matches are never mixed in. Deliberately not paginated
 * or unbounded -- this is the "Ver comentarios" on-demand fetch, never
 * loaded as part of a list of many players at once.
 */
export async function getRatingComments(userId: string, sportId: string): Promise<RatingCommentDto[]> {
  const ratings = await prisma.playerRating.findMany({
    where: {
      targetUserId: userId,
      AND: [{ comment: { not: null } }, { comment: { not: '' } }],
      match: { sportModality: { sportId } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_RATING_COMMENTS,
    include: { author: true, match: { include: { sportModality: { include: { sport: true } } } } },
  });

  return ratings.map(toRatingCommentDto);
}
