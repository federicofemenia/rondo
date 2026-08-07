import type { User } from '@prisma/client';
import type { LoginInputDto, RegisterInputDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { SEED_IDS } from '../../infrastructure/database/seedIds.js';
import { argon2PasswordHasher } from '../../infrastructure/auth/argon2PasswordHasher.js';
import { generateSessionToken, hashSessionToken } from '../../infrastructure/auth/sessionTokens.js';
import { MatchServiceError } from '../matches/errors.js';

export type CreatedSession = { user: User; token: string; expiresAt: Date };

const SESSION_TTL_DAYS_DEFAULT = 30;

/** Case-insensitive, whitespace-insensitive: "Federico"/"federico"/"FEDERICO" are all the same account. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function createSession(userId: string, ttlDays: number, userAgent: string | null): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt, userAgent },
  });
  return { token, expiresAt };
}

const ALL_DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];
const FULL_DAY_START_MINUTES = 0;
const FULL_DAY_END_MINUTES = 1440;

/**
 * Newly registered accounts start available every day, all hours, for
 * every sport that exists -- so they show up as a compatible candidate
 * right away -- until the player opens "Perfil deportivo" and narrows it
 * down themselves. Moved here from the old syncUserFromClerk (which ran
 * this on every request); now it only ever runs once, at registration.
 */
export async function createDefaultSportProfiles(userId: string): Promise<void> {
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

/** Only used by the auth:create-superadmin script -- normal registration never creates a ClubMembership (see registerUser below). */
export async function grantSenorPatoAdminMembership(userId: string): Promise<void> {
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

/**
 * Never creates a ClubMembership and never promotes to SUPERADMIN -- every
 * new account starts as a plain USER with no club, regardless of which
 * username they picked. The only way to become SUPERADMIN is the
 * auth:create-superadmin script, run explicitly and out-of-band.
 */
export async function registerUser(input: RegisterInputDto, userAgent: string | null, ttlDays = SESSION_TTL_DAYS_DEFAULT): Promise<CreatedSession> {
  const username = normalizeUsername(input.username);

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new MatchServiceError(409, 'USERNAME_TAKEN', 'Ese usuario ya está en uso.');
  }

  const passwordHash = await argon2PasswordHasher.hash(input.password);

  const user = await prisma.user.create({
    data: { username, passwordHash, displayName: input.displayName, role: 'USER' },
  });

  await createDefaultSportProfiles(user.id);

  const { token, expiresAt } = await createSession(user.id, ttlDays, userAgent);
  return { user, token, expiresAt };
}

/**
 * Deliberately identical error for "no such user" and "wrong password" --
 * never reveals which one failed, so a login attempt can't be used to
 * enumerate valid usernames.
 */
const INVALID_CREDENTIALS_MESSAGE = 'Usuario o contraseña incorrectos.';

export async function loginUser(input: LoginInputDto, userAgent: string | null, ttlDays = SESSION_TTL_DAYS_DEFAULT): Promise<CreatedSession> {
  const username = normalizeUsername(input.username);
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    // Still runs a hash verification against a fixed dummy hash even when
    // no user exists, so the response time doesn't leak whether the
    // username was valid via a timing side-channel.
    await argon2PasswordHasher.verify(
      '$argon2id$v=19$m=19456,t=2,p=1$jowe5pkXrbgqaMS7sqB4cQ$g4xgD8gVk0FVQceYIQolhFw+PdmNQATHWQTsDIT5l6g',
      input.password,
    );
    throw new MatchServiceError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE);
  }

  const valid = await argon2PasswordHasher.verify(user.passwordHash, input.password);
  if (!valid) {
    throw new MatchServiceError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE);
  }

  const { token, expiresAt } = await createSession(user.id, ttlDays, userAgent);
  return { user, token, expiresAt };
}

/** Idempotent: revoking an already-revoked or nonexistent session is a silent no-op, never an error. */
export async function logoutSession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    return;
  }
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const valid = await argon2PasswordHasher.verify(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw new MatchServiceError(401, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta.');
  }

  const newPasswordHash = await argon2PasswordHasher.hash(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: newPasswordHash } }),
    // Every OTHER session is revoked -- the one making this request stays
    // valid, so the user isn't logged out of the device they just used to
    // change their own password.
    prisma.session.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
