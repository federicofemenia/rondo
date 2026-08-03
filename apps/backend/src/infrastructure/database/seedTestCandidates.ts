import { prisma } from './prisma.js';

/**
 * Local-only dev convenience: creates a handful of test candidates with
 * broad availability (every day of the week, 00:00–24:00) across both
 * sports, so that whatever match you create manually while testing the
 * "Buscar jugadores" flow always has real candidates to invite — no need
 * to line up a specific day/time with the narrower matching demo data in
 * seed.ts. Idempotent (upsert throughout), safe to rerun.
 *
 * Like seedBeta.ts, these are NOT real Clerk identities and can never log
 * in — never run this against beta/production, only against your local
 * rondo_dev database.
 *
 *   pnpm --filter @rondo/backend seed:candidates
 */
const ALL_DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];
const FULL_DAY_START_MINUTES = 0;
const FULL_DAY_END_MINUTES = 1440;

const FOOTBALL_POSITIONS = ['Arquero', 'Defensor', 'Mediocampista', 'Delantero'];

const TEST_CANDIDATES = [
  { clerkUserId: 'test_candidate_1', email: 'candidato1.test@rondo.local', firstName: 'Candidato', lastName: 'Uno', sportCode: 'football', positions: FOOTBALL_POSITIONS },
  { clerkUserId: 'test_candidate_2', email: 'candidato2.test@rondo.local', firstName: 'Candidato', lastName: 'Dos', sportCode: 'football', positions: FOOTBALL_POSITIONS },
  { clerkUserId: 'test_candidate_3', email: 'candidato3.test@rondo.local', firstName: 'Candidato', lastName: 'Tres', sportCode: 'football', positions: FOOTBALL_POSITIONS },
  { clerkUserId: 'test_candidate_4', email: 'candidato4.test@rondo.local', firstName: 'Candidato', lastName: 'Cuatro', sportCode: 'padel', positions: [] },
  { clerkUserId: 'test_candidate_5', email: 'candidato5.test@rondo.local', firstName: 'Candidato', lastName: 'Cinco', sportCode: 'padel', positions: [] },
] as const;

async function run(): Promise<void> {
  for (const candidate of TEST_CANDIDATES) {
    const sport = await prisma.sport.findUnique({ where: { code: candidate.sportCode } });
    if (!sport) {
      console.error(`No existe el deporte "${candidate.sportCode}" — corré el seed base primero (pnpm seed:base).`);
      process.exitCode = 1;
      return;
    }

    const user = await prisma.user.upsert({
      where: { clerkUserId: candidate.clerkUserId },
      update: { email: candidate.email, firstName: candidate.firstName, lastName: candidate.lastName },
      create: { clerkUserId: candidate.clerkUserId, email: candidate.email, firstName: candidate.firstName, lastName: candidate.lastName },
    });

    const profile = await prisma.userSportProfile.upsert({
      where: { userId_sportId: { userId: user.id, sportId: sport.id } },
      update: { positions: [...candidate.positions], isAvailableForInvitations: true },
      create: { userId: user.id, sportId: sport.id, positions: [...candidate.positions], isAvailableForInvitations: true },
    });

    for (const dayOfWeek of ALL_DAYS_OF_WEEK) {
      await prisma.playerAvailability.upsert({
        where: {
          userSportProfileId_dayOfWeek_startMinutes_endMinutes: {
            userSportProfileId: profile.id,
            dayOfWeek,
            startMinutes: FULL_DAY_START_MINUTES,
            endMinutes: FULL_DAY_END_MINUTES,
          },
        },
        update: {},
        create: {
          userSportProfileId: profile.id,
          dayOfWeek,
          startMinutes: FULL_DAY_START_MINUTES,
          endMinutes: FULL_DAY_END_MINUTES,
        },
      });
    }

    console.log(`Candidato de prueba listo: ${candidate.firstName} ${candidate.lastName} (${candidate.sportCode}).`);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  run()
    .then(() => {
      console.log('Test candidates seed completed.');
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
