import type { User } from '@prisma/client';
import type { UpdateProfileInputDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';

/**
 * Builds the display name shown across the app, in priority order: the
 * name the user picked at registration (persisted on the account), their
 * username, then their email — falling back to a generic label only if
 * none of those exist.
 */
export function displayName(user: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
}): string {
  if (user.displayName) {
    return user.displayName;
  }
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.username || user.email || 'Jugador';
}

/**
 * avatarUrl is optional here (omit to leave untouched) -- it's set through
 * the separate R2 upload flow (see modules/users/users.controller.ts's
 * avatar/upload-url route and infrastructure/storage/r2AvatarStorage.ts),
 * not typed in by hand alongside sex/biography.
 */
export async function updateProfile(userId: string, input: UpdateProfileInputDto): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      sex: input.sex,
      biography: input.biography,
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
  });
}

/**
 * Only ACTIVE memberships count as "belonging to a club" anywhere in the
 * app (club selection when creating a match, the Home club badge,
 * reservations). An INACTIVE membership is treated the same as having none.
 */
export function getUserClubMemberships(userId: string) {
  return prisma.clubMembership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { club: true },
    orderBy: [{ isFavorite: 'desc' }, { club: { name: 'asc' } }],
  });
}
