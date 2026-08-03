import type { User } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { SEED_IDS } from '../../infrastructure/database/seedIds.js';
import type { AuthenticatedClerkProfile } from '../../infrastructure/auth/authAdapter.js';

export type BootstrapAdminConfig = {
  /** Primary source: stable and unique regardless of auth strategy. */
  clerkUserId?: string;
  /** Dev-only convenience fallback; never the source of truth for beta/production. */
  username?: string;
};

/**
 * Builds the display name shown across the app, in priority order: the
 * name the user picked at sign-up (persisted on the account), their real
 * name if Clerk provided one, their username, then their email — falling
 * back to a generic label only if none of those exist.
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

export async function syncUserFromClerk(profile: AuthenticatedClerkProfile, bootstrapAdmin?: BootstrapAdminConfig): Promise<User> {
  const user = await prisma.user.upsert({
    where: { clerkUserId: profile.clerkUserId },
    update: {
      username: profile.username ?? null,
      email: profile.email ?? null,
      displayName: profile.displayName ?? null,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    },
    create: {
      clerkUserId: profile.clerkUserId,
      username: profile.username ?? null,
      email: profile.email ?? null,
      displayName: profile.displayName ?? null,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    },
  });

  const isBootstrapAdmin =
    (Boolean(bootstrapAdmin?.clerkUserId) && profile.clerkUserId === bootstrapAdmin?.clerkUserId) ||
    (Boolean(bootstrapAdmin?.username) && Boolean(profile.username) && profile.username === bootstrapAdmin?.username);

  if (isBootstrapAdmin) {
    await grantSenorPatoAdminMembership(user.id);
  }

  return user;
}

async function grantSenorPatoAdminMembership(userId: string): Promise<void> {
  const club = await prisma.club.findUnique({ where: { id: SEED_IDS.club.senorPato } });
  if (!club) {
    return;
  }

  await prisma.clubMembership.upsert({
    where: { clubId_userId: { clubId: club.id, userId } },
    update: { role: 'CLUB_ADMIN', status: 'ACTIVE', isFavorite: true },
    create: { clubId: club.id, userId, role: 'CLUB_ADMIN', status: 'ACTIVE', isFavorite: true },
  });
}

export function getUserClubMemberships(userId: string) {
  return prisma.clubMembership.findMany({
    where: { userId },
    include: { club: true },
    orderBy: [{ isFavorite: 'desc' }, { club: { name: 'asc' } }],
  });
}
