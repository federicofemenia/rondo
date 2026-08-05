import type { PublicProfileDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
// Deliberately its own file rather than living in users.service.ts: that
// would create a cycle (users.service.ts -> matches/ratings.service.ts ->
// matches/matches.service.ts -> users.service.ts, since matches.service.ts
// re-exports displayName from here).
import { MatchServiceError } from '../matches/errors.js';
import { getRatingsSummary } from '../matches/ratings.service.js';
import { displayName } from './users.service.js';

/**
 * The public view of a player, shown on the player card opened from a
 * candidate — deliberately excludes email, username, clerkUserId and club
 * memberships. Always scoped to one sport: ratings and positions both come
 * from that sport specifically (a padel reputation/position says nothing
 * about someone's football game), never a cross-sport blend. Throws (never
 * returns null) so the controller can use the same sendServiceError
 * translation the rest of the matches/invitations modules already use.
 */
export async function getPublicProfile(userId: string, sportId: string): Promise<PublicProfileDto> {
  const [user, sport] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.sport.findUnique({ where: { id: sportId } }),
  ]);

  if (!user) {
    throw new MatchServiceError(404, 'USER_NOT_FOUND', 'El usuario indicado no existe.');
  }
  if (!sport) {
    throw new MatchServiceError(404, 'SPORT_NOT_FOUND', 'El deporte indicado no existe.');
  }

  const sportProfile = await prisma.userSportProfile.findUnique({
    where: { userId_sportId: { userId, sportId } },
    select: { positions: true },
  });

  const ratings = await getRatingsSummary(userId, sport);

  return {
    id: user.id,
    displayName: displayName(user),
    avatarUrl: user.avatarUrl,
    sex: user.sex,
    biography: user.biography,
    positions: sportProfile?.positions ?? [],
    ratings,
  };
}
