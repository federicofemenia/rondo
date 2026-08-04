import type { PublicProfileDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
// Deliberately its own file rather than living in users.service.ts: that
// would create a cycle (users.service.ts -> matches/ratings.service.ts ->
// matches/matches.service.ts -> users.service.ts, since matches.service.ts
// re-exports displayName from here).
import { getRatingsSummary } from '../matches/ratings.service.js';
import { displayName } from './users.service.js';

/**
 * The public view of a player, shown on the player card opened from a
 * candidate — deliberately excludes email, username, clerkUserId and club
 * memberships. Returns null when the user doesn't exist so the controller
 * can 404.
 */
export async function getPublicProfile(userId: string): Promise<PublicProfileDto | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  const sportProfiles = await prisma.userSportProfile.findMany({ where: { userId }, select: { positions: true } });
  const positions = [...new Set(sportProfiles.flatMap((profile) => profile.positions))];

  const ratings = await getRatingsSummary(userId);

  return {
    id: user.id,
    displayName: displayName(user),
    avatarUrl: user.avatarUrl,
    sex: user.sex,
    biography: user.biography,
    positions,
    ratings,
  };
}
