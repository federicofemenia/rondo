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

  // seed_-prefixed identities are the deterministic dev/test fixtures from
  // seed.ts (never a real Clerk account, see SEED_TESTER... / seedAuthAdapter):
  // their club membership and sport-profile state is precisely scripted by
  // the seed and by individual tests, so login-time defaults are skipped for
  // them entirely rather than organically mutating that fixture data.
  const isSeedFixture = profile.clerkUserId.startsWith('seed_');

  if (!isSeedFixture) {
    const isBootstrapAdmin =
      (Boolean(bootstrapAdmin?.clerkUserId) && profile.clerkUserId === bootstrapAdmin?.clerkUserId) ||
      (Boolean(bootstrapAdmin?.username) && Boolean(profile.username) && profile.username === bootstrapAdmin?.username);

    // Rondo is currently a single-club beta: every account is implicitly a
    // member of Señor Pato (there is no "join a club" flow yet), so the
    // create-match club picker (member-scoped, see useMyClubs) has something
    // to show without a separate onboarding step. The bootstrap admin gets
    // upgraded to CLUB_ADMIN on top of that; nobody else's role is touched.
    await ensureSenorPatoMembership(user.id, isBootstrapAdmin ? 'CLUB_ADMIN' : 'MEMBER');
    await ensureDefaultSportProfiles(user.id);
  }

  return user;
}

async function ensureSenorPatoMembership(userId: string, role: 'MEMBER' | 'CLUB_ADMIN'): Promise<void> {
  const club = await prisma.club.findUnique({ where: { id: SEED_IDS.club.senorPato } });
  if (!club) {
    return;
  }

  const existing = await prisma.clubMembership.findUnique({ where: { clubId_userId: { clubId: club.id, userId } } });

  if (!existing) {
    await prisma.clubMembership.create({
      data: { clubId: club.id, userId, role, status: 'ACTIVE', isFavorite: role === 'CLUB_ADMIN' },
    });
    return;
  }

  if (role === 'CLUB_ADMIN' && existing.role !== 'CLUB_ADMIN') {
    await prisma.clubMembership.update({ where: { id: existing.id }, data: { role: 'CLUB_ADMIN', isFavorite: true } });
  }
}

const ALL_DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];
const FULL_DAY_START_MINUTES = 0;
const FULL_DAY_END_MINUTES = 1440;

/**
 * Accounts start available every day, all hours, for every sport that
 * exists — so they show up as a compatible candidate right away — until the
 * player opens "Perfil deportivo" and narrows it down themselves. Runs on
 * every sync, but is a no-op the moment the user has at least one sport
 * profile of their own (whether auto-created here or created by hand), so
 * it can never clobber their own later edits — it only ever backfills
 * accounts that have configured nothing at all yet, new or pre-existing.
 */
async function ensureDefaultSportProfiles(userId: string): Promise<void> {
  const hasSportProfile = await prisma.userSportProfile.findFirst({ where: { userId }, select: { id: true } });
  if (hasSportProfile) {
    return;
  }

  const sports = await prisma.sport.findMany();

  for (const sport of sports) {
    const profile = await prisma.userSportProfile.create({
      data: { userId, sportId: sport.id, positions: [], isAvailableForInvitations: true },
    });

    await prisma.playerAvailability.createMany({
      data: ALL_DAYS_OF_WEEK.map((dayOfWeek) => ({
        userSportProfileId: profile.id,
        dayOfWeek,
        startMinutes: FULL_DAY_START_MINUTES,
        endMinutes: FULL_DAY_END_MINUTES,
      })),
    });
  }
}

export function getUserClubMemberships(userId: string) {
  return prisma.clubMembership.findMany({
    where: { userId },
    include: { club: true },
    orderBy: [{ isFavorite: 'desc' }, { club: { name: 'asc' } }],
  });
}
