/**
 * Creates (or promotes) a SUPERADMIN account. Run explicitly, never
 * automatically from build/deploy/predeploy -- this is the ONLY way an
 * account ever becomes SUPERADMIN; there is no auto-promotion by identity
 * anywhere in the app anymore (see auth.service.ts's registerUser, which
 * deliberately never does this).
 *
 * Usage:
 *   SUPERADMIN_USERNAME=federico SUPERADMIN_DISPLAY_NAME="Federico Femenia" SUPERADMIN_PASSWORD='...' \
 *     pnpm --filter @rondo/backend auth:create-superadmin
 *
 * Idempotent: re-running with the same username updates that same account
 * (password, displayName, role) rather than creating a duplicate.
 */
import { prisma } from '../database/prisma.js';
import { argon2PasswordHasher } from '../auth/argon2PasswordHasher.js';
import { createDefaultSportProfiles, grantSenorPatoAdminMembership, normalizeUsername } from '../../modules/auth/auth.service.js';

const MIN_PASSWORD_LENGTH = 8;

export async function main(): Promise<void> {
  const rawUsername = process.env.SUPERADMIN_USERNAME;
  const displayName = process.env.SUPERADMIN_DISPLAY_NAME;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!rawUsername || !displayName || !password) {
    console.error('SUPERADMIN_USERNAME, SUPERADMIN_DISPLAY_NAME and SUPERADMIN_PASSWORD are all required.');
    process.exitCode = 1;
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`SUPERADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const username = normalizeUsername(rawUsername);
  const passwordHash = await argon2PasswordHasher.hash(password);

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, displayName, role: 'SUPERADMIN' },
    create: { username, passwordHash, displayName, role: 'SUPERADMIN' },
  });

  await grantSenorPatoAdminMembership(user.id);

  // Guarded, not called unconditionally: createDefaultSportProfiles has no
  // upsert semantics of its own (a re-run on an existing account would hit
  // UserSportProfile's unique(userId, sportId) constraint), so this script
  // only backfills it the first time -- keeping the whole script idempotent.
  const hasSportProfile = await prisma.userSportProfile.findFirst({ where: { userId: user.id }, select: { id: true } });
  if (!hasSportProfile) {
    await createDefaultSportProfiles(user.id);
  }

  // Never logs the password, or the hash -- only enough to confirm which
  // account was affected.
  console.log(`SUPERADMIN ready: username=${username} id=${user.id}`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main()
    .catch((error) => {
      console.error('Failed to create superadmin:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
