import type { User } from '@prisma/client';
import type { UpdateProfileInputDto } from '@rondo/contracts';
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
  // their sport-profile state is precisely scripted by the seed and by
  // individual tests, so the default-availability backfill is skipped for
  // them entirely rather than organically mutating that fixture data.
  const isSeedFixture = profile.clerkUserId.startsWith('seed_');

  if (!isSeedFixture) {
    const isBootstrapAdmin =
      (Boolean(bootstrapAdmin?.clerkUserId) && profile.clerkUserId === bootstrapAdmin?.clerkUserId) ||
      (Boolean(bootstrapAdmin?.username) && Boolean(profile.username) && profile.username === bootstrapAdmin?.username);

    // No account is auto-enrolled in any club — there is no default club,
    // and users only ever appear in useMyClubs once they've actually joined
    // one (not implemented yet). The bootstrap admin is the sole exception,
    // seeded in as Señor Pato's CLUB_ADMIN so there's an initial owner.
    if (isBootstrapAdmin) {
      await grantSenorPatoAdminMembership(user.id);
    }
    await ensureDefaultSportProfiles(user.id);
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

/**
 * avatarUrl is deliberately not settable here — Clerk stays the sole
 * source of truth for it. The frontend uploads directly to Clerk (see
 * EditProfilePage.tsx), and the very next authenticated request re-syncs
 * avatarUrl from Clerk automatically (syncUserFromClerk runs on every
 * request), so there is nothing left for this endpoint to persist.
 */
export async function updateProfile(userId: string, input: UpdateProfileInputDto): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { sex: input.sex, biography: input.biography },
  });
}

export function getUserClubMemberships(userId: string) {
  return prisma.clubMembership.findMany({
    where: { userId },
    include: { club: true },
    orderBy: [{ isFavorite: 'desc' }, { club: { name: 'asc' } }],
  });
}
