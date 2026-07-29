import type { User } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { SEED_IDS } from '../../infrastructure/database/seedIds.js';
import type { AuthenticatedClerkProfile } from '../../infrastructure/auth/authAdapter.js';

const AUTO_ADMIN_EMAIL = 'femenia.f@gmail.com';

export async function syncUserFromClerk(profile: AuthenticatedClerkProfile): Promise<User> {
  const user = await prisma.user.upsert({
    where: { clerkUserId: profile.clerkUserId },
    update: {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    },
    create: {
      clerkUserId: profile.clerkUserId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    },
  });

  if (profile.email === AUTO_ADMIN_EMAIL) {
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
