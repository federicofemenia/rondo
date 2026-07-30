import type { DayOfWeek } from '@prisma/client';
import { prisma } from './prisma.js';
import { SEED_IDS } from './seedIds.js';

const DAYS_OF_WEEK: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function runSeed(): Promise<void> {
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
    update: { sportId: padel.id, code: 'padel-doubles', name: 'Dobles', playersCount: 4, displayOrder: 1 },
    create: {
      id: SEED_IDS.modalities.padelDoubles,
      sportId: padel.id,
      code: 'padel-doubles',
      name: 'Dobles',
      playersCount: 4,
      displayOrder: 1,
    },
  });

  const football5 = await prisma.sportModality.upsert({
    where: { id: SEED_IDS.modalities.football5 },
    update: { sportId: football.id, code: 'football-5', name: 'Fútbol 5', playersCount: 10, displayOrder: 1 },
    create: {
      id: SEED_IDS.modalities.football5,
      sportId: football.id,
      code: 'football-5',
      name: 'Fútbol 5',
      playersCount: 10,
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

  const courts = [
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

  // Demo players used to populate matches, participants and ratings. These are
  // seed-only bot accounts (never authenticated via Clerk), distinct from real
  // users who are created lazily on first login.
  const demoUsers = [
    { id: SEED_IDS.users.juan, clerkUserId: 'seed_juan_perez', email: 'juan.perez.seed@rondo.local', firstName: 'Juan', lastName: 'Pérez' },
    { id: SEED_IDS.users.martin, clerkUserId: 'seed_martin_gomez', email: 'martin.gomez.seed@rondo.local', firstName: 'Martín', lastName: 'Gómez' },
    { id: SEED_IDS.users.luciano, clerkUserId: 'seed_luciano_diaz', email: 'luciano.diaz.seed@rondo.local', firstName: 'Luciano', lastName: 'Díaz' },
    { id: SEED_IDS.users.ana, clerkUserId: 'seed_ana_torres', email: 'ana.torres.seed@rondo.local', firstName: 'Ana', lastName: 'Torres' },
  ];

  const [juan, martin, luciano, ana] = await Promise.all(
    demoUsers.map((user) =>
      prisma.user.upsert({
        where: { id: user.id },
        update: { clerkUserId: user.clerkUserId, email: user.email, firstName: user.firstName, lastName: user.lastName },
        create: user,
      }),
    ),
  );
  if (!juan || !martin || !luciano || !ana) {
    throw new Error('Failed to seed demo users.');
  }

  async function upsertMatch(input: {
    id: string;
    clubId: string | null;
    sportModalityId: string;
    courtId: string | null;
    organizerUserId: string;
    minPlayers: number;
    maxPlayers: number;
    startsAt: Date;
    endsAt: Date;
    status: 'ORGANIZING' | 'FULL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
    statusChangedAt: Date;
    statusChangedByType: 'USER' | 'SYSTEM';
    statusChangedByUserId: string | null;
    cancellationReason: string | null;
    participantUserIds: string[];
  }) {
    const match = await prisma.match.upsert({
      where: { id: input.id },
      update: {
        clubId: input.clubId,
        sportModalityId: input.sportModalityId,
        courtId: input.courtId,
        organizerUserId: input.organizerUserId,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: input.status,
        statusChangedAt: input.statusChangedAt,
        statusChangedByType: input.statusChangedByType,
        statusChangedByUserId: input.statusChangedByUserId,
        cancellationReason: input.cancellationReason,
      },
      create: {
        id: input.id,
        clubId: input.clubId,
        sportModalityId: input.sportModalityId,
        courtId: input.courtId,
        organizerUserId: input.organizerUserId,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: input.status,
        statusChangedAt: input.statusChangedAt,
        statusChangedByType: input.statusChangedByType,
        statusChangedByUserId: input.statusChangedByUserId,
        cancellationReason: input.cancellationReason,
      },
    });

    await Promise.all(
      input.participantUserIds.map((userId) =>
        prisma.matchParticipant.upsert({
          where: { matchId_userId: { matchId: match.id, userId } },
          update: {},
          create: { matchId: match.id, userId },
        }),
      ),
    );

    return match;
  }

  await upsertMatch({
    id: SEED_IDS.matches.organizing,
    clubId: club.id,
    sportModalityId: football5.id,
    courtId: courts.find((court) => court.code === 'football-5')!.id,
    organizerUserId: juan.id,
    minPlayers: 2,
    maxPlayers: 10,
    startsAt: hoursFromNow(48),
    endsAt: hoursFromNow(49),
    status: 'ORGANIZING',
    statusChangedAt: hoursFromNow(-1),
    statusChangedByType: 'SYSTEM',
    statusChangedByUserId: null,
    cancellationReason: null,
    participantUserIds: [martin.id],
  });

  await upsertMatch({
    id: SEED_IDS.matches.full,
    clubId: club.id,
    sportModalityId: padelDoubles.id,
    courtId: SEED_IDS.courts.padel1,
    organizerUserId: juan.id,
    minPlayers: 2,
    maxPlayers: 4,
    startsAt: hoursFromNow(72),
    endsAt: hoursFromNow(73.5),
    status: 'FULL',
    statusChangedAt: hoursFromNow(-1),
    statusChangedByType: 'SYSTEM',
    statusChangedByUserId: null,
    cancellationReason: null,
    participantUserIds: [juan.id, martin.id, luciano.id, ana.id],
  });

  await upsertMatch({
    id: SEED_IDS.matches.inProgress,
    clubId: club.id,
    sportModalityId: football5.id,
    courtId: SEED_IDS.courts.football5,
    organizerUserId: martin.id,
    minPlayers: 2,
    maxPlayers: 10,
    startsAt: hoursFromNow(-0.5),
    endsAt: hoursFromNow(0.5),
    status: 'IN_PROGRESS',
    statusChangedAt: hoursFromNow(-0.5),
    statusChangedByType: 'SYSTEM',
    statusChangedByUserId: null,
    cancellationReason: null,
    participantUserIds: [martin.id, juan.id, luciano.id],
  });

  await upsertMatch({
    id: SEED_IDS.matches.completed,
    clubId: club.id,
    sportModalityId: football5.id,
    courtId: SEED_IDS.courts.football5,
    organizerUserId: juan.id,
    minPlayers: 2,
    maxPlayers: 10,
    startsAt: hoursFromNow(-3),
    endsAt: hoursFromNow(-2),
    status: 'COMPLETED',
    statusChangedAt: hoursFromNow(-2),
    statusChangedByType: 'SYSTEM',
    statusChangedByUserId: null,
    cancellationReason: null,
    participantUserIds: [juan.id, martin.id, luciano.id, ana.id],
  });

  await upsertMatch({
    id: SEED_IDS.matches.cancelled,
    clubId: club.id,
    sportModalityId: padelDoubles.id,
    courtId: SEED_IDS.courts.padel2,
    organizerUserId: luciano.id,
    minPlayers: 2,
    maxPlayers: 4,
    startsAt: hoursFromNow(24),
    endsAt: hoursFromNow(25.5),
    status: 'CANCELLED',
    statusChangedAt: hoursFromNow(-2),
    statusChangedByType: 'USER',
    statusChangedByUserId: luciano.id,
    cancellationReason: 'Faltan jugadores para completar el partido.',
    participantUserIds: [luciano.id, ana.id],
  });

  await upsertMatch({
    id: SEED_IDS.matches.expired,
    clubId: club.id,
    sportModalityId: football5.id,
    courtId: SEED_IDS.courts.football5,
    organizerUserId: ana.id,
    minPlayers: 2,
    maxPlayers: 10,
    startsAt: hoursFromNow(-5),
    endsAt: hoursFromNow(-4),
    status: 'EXPIRED',
    statusChangedAt: hoursFromNow(-4),
    statusChangedByType: 'SYSTEM',
    statusChangedByUserId: null,
    cancellationReason: null,
    participantUserIds: [ana.id],
  });

  await prisma.playerRating.upsert({
    where: {
      matchId_authorUserId_targetUserId: {
        matchId: SEED_IDS.matches.completed,
        authorUserId: juan.id,
        targetUserId: martin.id,
      },
    },
    update: { gameplayScore: 5, conductScore: 5, comment: 'Excelente compañero de equipo.' },
    create: {
      id: SEED_IDS.ratings.juanRatesMartin,
      matchId: SEED_IDS.matches.completed,
      authorUserId: juan.id,
      targetUserId: martin.id,
      gameplayScore: 5,
      conductScore: 5,
      comment: 'Excelente compañero de equipo.',
    },
  });
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  runSeed()
    .then(() => {
      console.log('Seed completed.');
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
