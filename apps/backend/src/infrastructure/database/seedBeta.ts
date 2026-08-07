import { prisma } from './prisma.js';

/**
 * Optional, manual-only script for the beta: attaches a demo football sport
 * profile (so matching/invitations have something to work with right away)
 * to testers who have ALREADY registered (POST /api/v1/auth/register) —
 * it looks each one up by username and skips (never creates) anyone not
 * found. Never invoked from runSeed()/runBaseSeed() and never run
 * automatically during a deploy; run it by hand, once, after testers have
 * registered their own accounts:
 *
 *   pnpm --filter @rondo/backend seed:beta
 *
 * Edit BETA_TESTER_USERNAMES below to match the usernames testers actually
 * registered with before running it.
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
      console.log(`Todavía no existe una cuenta para "${username}" — se omite (registrala primero y volvé a correr este script).`);
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
