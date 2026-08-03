import type { Club, Sport, SportModality } from '@prisma/client';
import type { DayOfWeek } from '@prisma/client';
import { prisma } from './prisma.js';
import { SEED_IDS } from './seedIds.js';

const DAYS_OF_WEEK: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

type CourtSeed = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  sportModalityId: string;
  slotDurationMinutes: number;
  pricePerHour: number;
};

export type BaseSeedResult = {
  padel: Sport;
  football: Sport;
  padelDoubles: SportModality;
  football5: SportModality;
  club: Club;
  courts: CourtSeed[];
};

/**
 * Catalog data every environment needs: sports, modalities, Club Señor
 * Pato, its courts, opening hours, and the welcome news item. Idempotent
 * (upsert throughout) and never deletes existing data — safe to run
 * against local dev or the beta database alike.
 */
export async function runBaseSeed(): Promise<BaseSeedResult> {
  const padel = await prisma.sport.upsert({
    where: { id: SEED_IDS.sports.padel },
    update: { code: 'padel', name: 'Pádel', displayOrder: 2 },
    create: { id: SEED_IDS.sports.padel, code: 'padel', name: 'Pádel', displayOrder: 2 },
  });

  const football = await prisma.sport.upsert({
    where: { id: SEED_IDS.sports.football },
    update: { code: 'football', name: 'Fútbol', displayOrder: 1 },
    create: { id: SEED_IDS.sports.football, code: 'football', name: 'Fútbol', displayOrder: 1 },
  });

  const padelDoubles = await prisma.sportModality.upsert({
    where: { id: SEED_IDS.modalities.padelDoubles },
    update: { sportId: padel.id, code: 'padel-doubles', name: 'Dobles', playersCount: 4, durationMinutes: 90, displayOrder: 1 },
    create: {
      id: SEED_IDS.modalities.padelDoubles,
      sportId: padel.id,
      code: 'padel-doubles',
      name: 'Dobles',
      playersCount: 4,
      durationMinutes: 90,
      displayOrder: 1,
    },
  });

  const football5 = await prisma.sportModality.upsert({
    where: { id: SEED_IDS.modalities.football5 },
    update: { sportId: football.id, code: 'football-5', name: 'Fútbol 5', playersCount: 10, durationMinutes: 60, displayOrder: 1 },
    create: {
      id: SEED_IDS.modalities.football5,
      sportId: football.id,
      code: 'football-5',
      name: 'Fútbol 5',
      playersCount: 10,
      durationMinutes: 60,
      displayOrder: 1,
    },
  });

  const club = await prisma.club.upsert({
    where: { id: SEED_IDS.club.senorPato },
    update: {
      code: 'senor-pato',
      name: 'Señor Pato',
      description: 'Club deportivo con canchas de pádel y fútbol 5.',
      address: 'Centenario 123',
      city: 'Moreno',
      province: 'Buenos Aires',
      timezone: 'America/Argentina/Buenos_Aires',
      status: 'ACTIVE',
    },
    create: {
      id: SEED_IDS.club.senorPato,
      code: 'senor-pato',
      name: 'Señor Pato',
      description: 'Club deportivo con canchas de pádel y fútbol 5.',
      address: 'Centenario 123',
      city: 'Moreno',
      province: 'Buenos Aires',
      timezone: 'America/Argentina/Buenos_Aires',
      status: 'ACTIVE',
    },
  });

  await Promise.all(
    DAYS_OF_WEEK.map((dayOfWeek) =>
      prisma.openingHour.upsert({
        where: { clubId_dayOfWeek: { clubId: club.id, dayOfWeek } },
        update: { opensAt: '10:00', closesAt: '00:00' },
        create: { clubId: club.id, dayOfWeek, opensAt: '10:00', closesAt: '00:00' },
      }),
    ),
  );

  const courts: CourtSeed[] = [
    { id: SEED_IDS.courts.padel1, code: 'padel-1', name: 'Pádel 1', displayOrder: 1, sportModalityId: padelDoubles.id, slotDurationMinutes: 90, pricePerHour: 60000 },
    { id: SEED_IDS.courts.padel2, code: 'padel-2', name: 'Pádel 2', displayOrder: 2, sportModalityId: padelDoubles.id, slotDurationMinutes: 90, pricePerHour: 60000 },
    { id: SEED_IDS.courts.padel3, code: 'padel-3', name: 'Pádel 3', displayOrder: 3, sportModalityId: padelDoubles.id, slotDurationMinutes: 90, pricePerHour: 60000 },
    { id: SEED_IDS.courts.football5, code: 'football-5', name: 'Fútbol 5', displayOrder: 4, sportModalityId: football5.id, slotDurationMinutes: 60, pricePerHour: 50000 },
  ];

  for (const court of courts) {
    await prisma.court.upsert({
      where: { id: court.id },
      update: {
        clubId: club.id,
        code: court.code,
        name: court.name,
        displayOrder: court.displayOrder,
        sportModalityId: court.sportModalityId,
        slotDurationMinutes: court.slotDurationMinutes,
        pricePerHour: court.pricePerHour,
        active: true,
      },
      create: {
        id: court.id,
        clubId: club.id,
        code: court.code,
        name: court.name,
        displayOrder: court.displayOrder,
        sportModalityId: court.sportModalityId,
        slotDurationMinutes: court.slotDurationMinutes,
        pricePerHour: court.pricePerHour,
        active: true,
      },
    });
  }

  await prisma.clubNews.upsert({
    where: { id: SEED_IDS.clubNews.welcome },
    update: {
      clubId: club.id,
      title: 'Bienvenidos a Señor Pato',
      message: 'Ya podés organizar partidos y reservar canchas desde Rondo.',
      published: true,
    },
    create: {
      id: SEED_IDS.clubNews.welcome,
      clubId: club.id,
      title: 'Bienvenidos a Señor Pato',
      message: 'Ya podés organizar partidos y reservar canchas desde Rondo.',
      published: true,
    },
  });

  return { padel, football, padelDoubles, football5, club, courts };
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  runBaseSeed()
    .then(() => {
      console.log('Base seed completed.');
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
