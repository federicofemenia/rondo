import { prisma } from './prisma.js';

/**
 * Optional, manual-only script for the beta: attaches a demo football sport
 * profile (so matching/invitations have something to work with right away)
 * to testers who have ALREADY logged in at least once — it looks each one
 * up by username and skips (never creates) anyone not found, since a
 * username with no matching User means no real Clerk account has synced
 * yet. Never invoked from runSeed()/runBaseSeed() and never run
 * automatically during a deploy; run it by hand, once, after testers have
 * signed in for the first time:
 *
 *   pnpm --filter @rondo/backend seed:beta
 *
 * Edit BETA_TESTER_USERNAMES below to match the usernames actually created
 * in the beta Clerk instance before running it.
 */
const BETA_TESTER_USERNAMES = ['fede', 'juan', 'martin', 'lucas', 'nico', 'agustin'];

const DEFAULT_POSITIONS = ['Defensor', 'Mediocampista'];

async function runBetaSeed(): Promise<void> {
  const football = await prisma.sport.findUnique({ where: { code: 'football' } });
  if (!football) {
    console.error('El seed base todavía no corrió (no existe el deporte "football"). Ejecutá `pnpm seed:base` primero.');
    process.exitCode = 1;
    return;
  }

  for (const username of BETA_TESTER_USERNAMES) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.log(`Sin cuenta sincronizada todavía para "${username}" — se omite (iniciá sesión una vez y volvé a correr este script).`);
      continue;
    }

    await prisma.userSportProfile.upsert({
      where: { userId_sportId: { userId: user.id, sportId: football.id } },
      update: {},
      create: {
        userId: user.id,
        sportId: football.id,
        positions: DEFAULT_POSITIONS,
        isAvailableForInvitations: true,
      },
    });
    console.log(`Perfil deportivo demo asociado a "${username}".`);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  runBetaSeed()
    .then(() => {
      console.log('Beta seed completed.');
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
