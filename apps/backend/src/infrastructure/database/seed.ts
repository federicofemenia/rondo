import { prisma } from './prisma.js';
import { SEED_IDS } from './seedIds.js';
import { runBaseSeed } from './seedBase.js';

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function daysFromNowUtc(days: number): Date {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Derives a seed availability window that comfortably contains startsAt/endsAt. */
function windowAround(startsAt: Date, endsAt: Date): { availabilityStartMinutes: number; availabilityEndMinutes: number } {
  const startMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();
  const endMinutes = endsAt.getUTCHours() * 60 + endsAt.getUTCMinutes();
  return {
    availabilityStartMinutes: Math.max(0, startMinutes - 60),
    availabilityEndMinutes: Math.min(1440, Math.max(endMinutes + 60, startMinutes + 60)),
  };
}

export async function runSeed(): Promise<void> {
  const { padel, football, padelDoubles, football5, club, courts } = await runBaseSeed();

  // Demo players used to populate matches, participants and ratings. These
  // are seed-only bot accounts, distinct from real users who register
  // themselves through POST /api/v1/auth/register. Their passwordHash is a
  // fixed, shared, publicly-documented sentinel (hash of the literal string
  // 'rondo-seed-fixture-not-a-real-password') -- these accounts are never
  // meant to be logged into for real, only to exist as fixture data.
  const SEED_FIXTURE_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$hX9qqfk9StB6ODXEtpWWMg$/YUsAGGNLZLaE0tPaqr2TDVdrcjtP+pyxfFh/LUUPgQ';

  const demoUsers = [
    { id: SEED_IDS.users.juan, username: 'juan_perez_demo', email: 'juan.perez.seed@rondo.local', firstName: 'Juan', lastName: 'Pérez' },
    { id: SEED_IDS.users.martin, username: 'martin_gomez_demo', email: 'martin.gomez.seed@rondo.local', firstName: 'Martín', lastName: 'Gómez' },
    { id: SEED_IDS.users.luciano, username: 'luciano_diaz_demo', email: 'luciano.diaz.seed@rondo.local', firstName: 'Luciano', lastName: 'Díaz' },
    { id: SEED_IDS.users.ana, username: 'ana_torres_demo', email: 'ana.torres.seed@rondo.local', firstName: 'Ana', lastName: 'Torres' },
    { id: SEED_IDS.users.sofia, username: 'sofia_castro_demo', email: 'sofia.castro.seed@rondo.local', firstName: 'Sofía', lastName: 'Castro' },
    { id: SEED_IDS.users.camila, username: 'camila_ruiz_demo', email: 'camila.ruiz.seed@rondo.local', firstName: 'Camila', lastName: 'Ruiz' },
    { id: SEED_IDS.users.diego, username: 'diego_navarro_demo', email: 'diego.navarro.seed@rondo.local', firstName: 'Diego', lastName: 'Navarro' },
    { id: SEED_IDS.users.valentina, username: 'valentina_ortiz_demo', email: 'valentina.ortiz.seed@rondo.local', firstName: 'Valentina', lastName: 'Ortiz' },
  ];

  const [juan, martin, luciano, ana, sofia, camila, diego, valentina] = await Promise.all(
    demoUsers.map((user) =>
      prisma.user.upsert({
        where: { id: user.id },
        update: { username: user.username, email: user.email, firstName: user.firstName, lastName: user.lastName },
        create: { ...user, passwordHash: SEED_FIXTURE_PASSWORD_HASH },
      }),
    ),
  );
  if (!juan || !martin || !luciano || !ana || !sofia || !camila || !diego || !valentina) {
    throw new Error('Failed to seed demo users.');
  }

  // Sport profiles + weekly availability for the demo players, used to
  // exercise the sport-profile screen and endpoints against real data.
  const juanFootballProfile = await prisma.userSportProfile.upsert({
    where: { id: SEED_IDS.sportProfiles.juanFootball },
    update: { userId: juan.id, sportId: football.id, positions: ['Defensor', 'Mediocampista'], isAvailableForInvitations: true },
    create: {
      id: SEED_IDS.sportProfiles.juanFootball,
      userId: juan.id,
      sportId: football.id,
      positions: ['Defensor', 'Mediocampista'],
      isAvailableForInvitations: true,
    },
  });

  const martinPadelProfile = await prisma.userSportProfile.upsert({
    where: { id: SEED_IDS.sportProfiles.martinPadel },
    update: { userId: martin.id, sportId: padel.id, positions: [], isAvailableForInvitations: true },
    create: { id: SEED_IDS.sportProfiles.martinPadel, userId: martin.id, sportId: padel.id, positions: [], isAvailableForInvitations: true },
  });

  await prisma.userSportProfile.upsert({
    where: { id: SEED_IDS.sportProfiles.lucianoFootball },
    update: { userId: luciano.id, sportId: football.id, positions: ['Arquero'], isAvailableForInvitations: false },
    create: {
      id: SEED_IDS.sportProfiles.lucianoFootball,
      userId: luciano.id,
      sportId: football.id,
      positions: ['Arquero'],
      isAvailableForInvitations: false,
    },
  });

  await prisma.playerAvailability.upsert({
    where: { id: SEED_IDS.availability.juanFootballMonday },
    update: { userSportProfileId: juanFootballProfile.id, dayOfWeek: 1, startMinutes: 18 * 60, endMinutes: 22 * 60 },
    create: {
      id: SEED_IDS.availability.juanFootballMonday,
      userSportProfileId: juanFootballProfile.id,
      dayOfWeek: 1,
      startMinutes: 18 * 60,
      endMinutes: 22 * 60,
    },
  });

  await prisma.playerAvailability.upsert({
    where: { id: SEED_IDS.availability.juanFootballWednesday },
    update: { userSportProfileId: juanFootballProfile.id, dayOfWeek: 3, startMinutes: 18 * 60, endMinutes: 22 * 60 },
    create: {
      id: SEED_IDS.availability.juanFootballWednesday,
      userSportProfileId: juanFootballProfile.id,
      dayOfWeek: 3,
      startMinutes: 18 * 60,
      endMinutes: 22 * 60,
    },
  });

  await prisma.playerAvailability.upsert({
    where: { id: SEED_IDS.availability.martinPadelSaturday },
    update: { userSportProfileId: martinPadelProfile.id, dayOfWeek: 6, startMinutes: 10 * 60, endMinutes: 14 * 60 },
    create: {
      id: SEED_IDS.availability.martinPadelSaturday,
      userSportProfileId: martinPadelProfile.id,
      dayOfWeek: 6,
      startMinutes: 10 * 60,
      endMinutes: 14 * 60,
    },
  });

  async function upsertMatch(input: {
    id: string;
    clubId: string | null;
    sportModalityId: string;
    courtId: string | null;
    organizerUserId: string;
    minPlayers: number;
    maxPlayers: number;
    scheduledDate: Date;
    availabilityStartMinutes: number;
    availabilityEndMinutes: number;
    startsAt: Date | null;
    endsAt: Date | null;
    status: 'ORGANIZING' | 'FULL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
    statusChangedAt: Date;
    statusChangedByType: 'USER' | 'SYSTEM';
    statusChangedByUserId: string | null;
    cancellationReason: string | null;
    participantUserIds: string[];
  }) {
    const venueType = input.clubId ? 'CLUB' : 'TO_BE_DEFINED';

    const match = await prisma.match.upsert({
      where: { id: input.id },
      update: {
        clubId: input.clubId,
        venueType,
        sportModalityId: input.sportModalityId,
        courtId: input.courtId,
        organizerUserId: input.organizerUserId,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
        scheduledDate: input.scheduledDate,
        availabilityStartMinutes: input.availabilityStartMinutes,
        availabilityEndMinutes: input.availabilityEndMinutes,
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
        venueType,
        sportModalityId: input.sportModalityId,
        courtId: input.courtId,
        organizerUserId: input.organizerUserId,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
        scheduledDate: input.scheduledDate,
        availabilityStartMinutes: input.availabilityStartMinutes,
        availabilityEndMinutes: input.availabilityEndMinutes,
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

  // Captured outside the block (unlike the other demo matches below) so the
  // candidates seed data further down can derive a weekly slot that actually
  // overlaps this match's day/time, regardless of when the seed runs.
  const organizingMatchStartsAt = hoursFromNow(48);
  const organizingMatchEndsAt = hoursFromNow(49);
  {
    await upsertMatch({
      id: SEED_IDS.matches.organizing,
      clubId: club.id,
      sportModalityId: football5.id,
      courtId: courts.find((court) => court.code === 'football-5')!.id,
      organizerUserId: juan.id,
      minPlayers: 2,
      maxPlayers: 10,
      scheduledDate: startOfUtcDay(organizingMatchStartsAt),
      ...windowAround(organizingMatchStartsAt, organizingMatchEndsAt),
      startsAt: organizingMatchStartsAt,
      endsAt: organizingMatchEndsAt,
      status: 'ORGANIZING',
      statusChangedAt: hoursFromNow(-1),
      statusChangedByType: 'SYSTEM',
      statusChangedByUserId: null,
      cancellationReason: null,
      participantUserIds: [martin.id],
    });
  }

  {
    const startsAt = hoursFromNow(72);
    const endsAt = hoursFromNow(73.5);
    await upsertMatch({
      id: SEED_IDS.matches.full,
      clubId: club.id,
      sportModalityId: padelDoubles.id,
      courtId: SEED_IDS.courts.padel1,
      organizerUserId: juan.id,
      minPlayers: 2,
      maxPlayers: 4,
      scheduledDate: startOfUtcDay(startsAt),
      ...windowAround(startsAt, endsAt),
      startsAt,
      endsAt,
      status: 'FULL',
      statusChangedAt: hoursFromNow(-1),
      statusChangedByType: 'SYSTEM',
      statusChangedByUserId: null,
      cancellationReason: null,
      participantUserIds: [juan.id, martin.id, luciano.id, ana.id],
    });
  }

  {
    const startsAt = hoursFromNow(-0.5);
    const endsAt = hoursFromNow(0.5);
    await upsertMatch({
      id: SEED_IDS.matches.inProgress,
      clubId: club.id,
      sportModalityId: football5.id,
      courtId: SEED_IDS.courts.football5,
      organizerUserId: martin.id,
      minPlayers: 2,
      maxPlayers: 10,
      scheduledDate: startOfUtcDay(startsAt),
      ...windowAround(startsAt, endsAt),
      startsAt,
      endsAt,
      status: 'IN_PROGRESS',
      statusChangedAt: hoursFromNow(-0.5),
      statusChangedByType: 'SYSTEM',
      statusChangedByUserId: null,
      cancellationReason: null,
      participantUserIds: [martin.id, juan.id, luciano.id],
    });
  }

  {
    const startsAt = hoursFromNow(-3);
    const endsAt = hoursFromNow(-2);
    await upsertMatch({
      id: SEED_IDS.matches.completed,
      clubId: club.id,
      sportModalityId: football5.id,
      courtId: SEED_IDS.courts.football5,
      organizerUserId: juan.id,
      minPlayers: 2,
      maxPlayers: 10,
      scheduledDate: startOfUtcDay(startsAt),
      ...windowAround(startsAt, endsAt),
      startsAt,
      endsAt,
      status: 'COMPLETED',
      statusChangedAt: hoursFromNow(-2),
      statusChangedByType: 'SYSTEM',
      statusChangedByUserId: null,
      cancellationReason: null,
      participantUserIds: [juan.id, martin.id, luciano.id, ana.id],
    });
  }

  {
    const startsAt = hoursFromNow(24);
    const endsAt = hoursFromNow(25.5);
    await upsertMatch({
      id: SEED_IDS.matches.cancelled,
      clubId: club.id,
      sportModalityId: padelDoubles.id,
      courtId: SEED_IDS.courts.padel2,
      organizerUserId: luciano.id,
      minPlayers: 2,
      maxPlayers: 4,
      scheduledDate: startOfUtcDay(startsAt),
      ...windowAround(startsAt, endsAt),
      startsAt,
      endsAt,
      status: 'CANCELLED',
      statusChangedAt: hoursFromNow(-2),
      statusChangedByType: 'USER',
      statusChangedByUserId: luciano.id,
      cancellationReason: 'Faltan jugadores para completar el partido.',
      participantUserIds: [luciano.id, ana.id],
    });
  }

  {
    const startsAt = hoursFromNow(-5);
    const endsAt = hoursFromNow(-4);
    await upsertMatch({
      id: SEED_IDS.matches.expired,
      clubId: club.id,
      sportModalityId: football5.id,
      courtId: SEED_IDS.courts.football5,
      organizerUserId: ana.id,
      minPlayers: 2,
      maxPlayers: 10,
      scheduledDate: startOfUtcDay(startsAt),
      ...windowAround(startsAt, endsAt),
      startsAt,
      endsAt,
      status: 'EXPIRED',
      statusChangedAt: hoursFromNow(-4),
      statusChangedByType: 'SYSTEM',
      statusChangedByUserId: null,
      cancellationReason: null,
      participantUserIds: [ana.id],
    });
  }

  // A match with a confirmed day but no confirmed time yet: the organizer
  // picked a day and an availability window, but has not locked in an exact
  // startsAt. Stays ORGANIZING indefinitely until a time is set or the day
  // (tomorrow) ends. Captured outside the call so the candidates seed data
  // below can derive a weekly slot that overlaps this exact day.
  const pendingScheduleDate = daysFromNowUtc(1);
  await upsertMatch({
    id: SEED_IDS.matches.pendingSchedule,
    clubId: club.id,
    sportModalityId: football5.id,
    courtId: null,
    organizerUserId: juan.id,
    minPlayers: 2,
    maxPlayers: 10,
    scheduledDate: pendingScheduleDate,
    availabilityStartMinutes: 14 * 60,
    availabilityEndMinutes: 19 * 60,
    startsAt: null,
    endsAt: null,
    status: 'ORGANIZING',
    statusChangedAt: hoursFromNow(-1),
    statusChangedByType: 'USER',
    statusChangedByUserId: juan.id,
    cancellationReason: null,
    participantUserIds: [],
  });

  // A match whose scheduled day already ended without the organizer ever
  // confirming a time: the lifecycle expires it automatically so it cannot
  // linger forever without a startsAt.
  await upsertMatch({
    id: SEED_IDS.matches.expiredNoSchedule,
    clubId: club.id,
    sportModalityId: padelDoubles.id,
    courtId: null,
    organizerUserId: martin.id,
    minPlayers: 2,
    maxPlayers: 4,
    scheduledDate: daysFromNowUtc(-2),
    availabilityStartMinutes: 10 * 60,
    availabilityEndMinutes: 22 * 60,
    startsAt: null,
    endsAt: null,
    status: 'EXPIRED',
    statusChangedAt: daysFromNowUtc(-1),
    statusChangedByType: 'SYSTEM',
    statusChangedByUserId: null,
    cancellationReason: null,
    participantUserIds: [martin.id],
  });

  // A match completed well over a day ago, so its chat closed for good (the
  // 24h post-match grace window has already passed).
  await upsertMatch({
    id: SEED_IDS.matches.completedStale,
    clubId: club.id,
    sportModalityId: football5.id,
    courtId: SEED_IDS.courts.football5,
    organizerUserId: ana.id,
    minPlayers: 2,
    maxPlayers: 10,
    scheduledDate: startOfUtcDay(hoursFromNow(-31)),
    ...windowAround(hoursFromNow(-31), hoursFromNow(-30)),
    startsAt: hoursFromNow(-31),
    endsAt: hoursFromNow(-30),
    status: 'COMPLETED',
    statusChangedAt: hoursFromNow(-30),
    statusChangedByType: 'SYSTEM',
    statusChangedByUserId: null,
    cancellationReason: null,
    participantUserIds: [ana.id, diego.id],
  });

  // Candidate-matching demo data: sport profiles + weekly availability crafted
  // to exercise every rule of the deterministic matching (see MATCHES/USERS
  // docs) against the real matches seeded above.
  const sofiaFootballProfile = await prisma.userSportProfile.upsert({
    where: { id: SEED_IDS.sportProfiles.sofiaFootball },
    update: { userId: sofia.id, sportId: football.id, positions: ['Delantero'], isAvailableForInvitations: true },
    create: { id: SEED_IDS.sportProfiles.sofiaFootball, userId: sofia.id, sportId: football.id, positions: ['Delantero'], isAvailableForInvitations: true },
  });

  // Compatible candidate: covers matches.organizing's exact startsAt-endsAt window with margin on both sides.
  const organizingStartMinutes = organizingMatchStartsAt.getUTCHours() * 60 + organizingMatchStartsAt.getUTCMinutes();
  const organizingEndMinutes = organizingMatchEndsAt.getUTCHours() * 60 + organizingMatchEndsAt.getUTCMinutes();
  await prisma.playerAvailability.upsert({
    where: { id: SEED_IDS.availability.sofiaFootballMatchDay },
    update: {
      userSportProfileId: sofiaFootballProfile.id,
      dayOfWeek: organizingMatchStartsAt.getUTCDay(),
      startMinutes: Math.max(0, organizingStartMinutes - 60),
      endMinutes: Math.min(1440, organizingEndMinutes + 60),
    },
    create: {
      id: SEED_IDS.availability.sofiaFootballMatchDay,
      userSportProfileId: sofiaFootballProfile.id,
      dayOfWeek: organizingMatchStartsAt.getUTCDay(),
      startMinutes: Math.max(0, organizingStartMinutes - 60),
      endMinutes: Math.min(1440, organizingEndMinutes + 60),
    },
  });

  // Incompatible availability: right sport, available for invitations, but only ever free early morning.
  const valentinaFootballProfile = await prisma.userSportProfile.upsert({
    where: { id: SEED_IDS.sportProfiles.valentinaFootball },
    update: { userId: valentina.id, sportId: football.id, positions: ['Delantero'], isAvailableForInvitations: true },
    create: {
      id: SEED_IDS.sportProfiles.valentinaFootball,
      userId: valentina.id,
      sportId: football.id,
      positions: ['Delantero'],
      isAvailableForInvitations: true,
    },
  });

  await prisma.playerAvailability.upsert({
    where: { id: SEED_IDS.availability.valentinaFootballIncompatible },
    update: { userSportProfileId: valentinaFootballProfile.id, dayOfWeek: 1, startMinutes: 5 * 60, endMinutes: 7 * 60 },
    create: {
      id: SEED_IDS.availability.valentinaFootballIncompatible,
      userSportProfileId: valentinaFootballProfile.id,
      dayOfWeek: 1,
      startMinutes: 5 * 60,
      endMinutes: 7 * 60,
    },
  });

  // Different positions: available, right sport, overlapping schedule with matches.pendingSchedule, but only plays Arquero.
  const camilaFootballProfile = await prisma.userSportProfile.upsert({
    where: { id: SEED_IDS.sportProfiles.camilaFootball },
    update: { userId: camila.id, sportId: football.id, positions: ['Arquero'], isAvailableForInvitations: true },
    create: { id: SEED_IDS.sportProfiles.camilaFootball, userId: camila.id, sportId: football.id, positions: ['Arquero'], isAvailableForInvitations: true },
  });

  await prisma.playerAvailability.upsert({
    where: { id: SEED_IDS.availability.camilaFootballPendingDay },
    update: { userSportProfileId: camilaFootballProfile.id, dayOfWeek: pendingScheduleDate.getUTCDay(), startMinutes: 15 * 60, endMinutes: 18 * 60 },
    create: {
      id: SEED_IDS.availability.camilaFootballPendingDay,
      userSportProfileId: camilaFootballProfile.id,
      dayOfWeek: pendingScheduleDate.getUTCDay(),
      startMinutes: 15 * 60,
      endMinutes: 18 * 60,
    },
  });

  // Different sport: only plays pádel, so never a football candidate.
  const diegoPadelProfile = await prisma.userSportProfile.upsert({
    where: { id: SEED_IDS.sportProfiles.diegoPadel },
    update: { userId: diego.id, sportId: padel.id, positions: [], isAvailableForInvitations: true },
    create: { id: SEED_IDS.sportProfiles.diegoPadel, userId: diego.id, sportId: padel.id, positions: [], isAvailableForInvitations: true },
  });

  await prisma.playerAvailability.upsert({
    where: { id: SEED_IDS.availability.diegoPadelSunday },
    update: { userSportProfileId: diegoPadelProfile.id, dayOfWeek: 0, startMinutes: 10 * 60, endMinutes: 13 * 60 },
    create: {
      id: SEED_IDS.availability.diegoPadelSunday,
      userSportProfileId: diegoPadelProfile.id,
      dayOfWeek: 0,
      startMinutes: 10 * 60,
      endMinutes: 13 * 60,
    },
  });

  // Invitation examples covering each status, kept to the minimum needed to
  // exercise "Mis invitaciones" and the match-detail banner against real data.
  await prisma.matchInvitation.upsert({
    where: { id: SEED_IDS.invitations.pending },
    update: { matchId: SEED_IDS.matches.organizing, invitedUserId: camila.id, invitedById: juan.id, position: null, status: 'PENDING', respondedAt: null },
    create: {
      id: SEED_IDS.invitations.pending,
      matchId: SEED_IDS.matches.organizing,
      invitedUserId: camila.id,
      invitedById: juan.id,
      position: null,
      status: 'PENDING',
    },
  });

  // Accepted invitations must be reflected by a real participant, exactly like the endpoint does.
  await prisma.matchParticipant.upsert({
    where: { matchId_userId: { matchId: SEED_IDS.matches.organizing, userId: sofia.id } },
    update: {},
    create: { matchId: SEED_IDS.matches.organizing, userId: sofia.id },
  });
  await prisma.matchInvitation.upsert({
    where: { id: SEED_IDS.invitations.accepted },
    update: {
      matchId: SEED_IDS.matches.organizing,
      invitedUserId: sofia.id,
      invitedById: juan.id,
      position: null,
      status: 'ACCEPTED',
      respondedAt: hoursFromNow(-1),
    },
    create: {
      id: SEED_IDS.invitations.accepted,
      matchId: SEED_IDS.matches.organizing,
      invitedUserId: sofia.id,
      invitedById: juan.id,
      position: null,
      status: 'ACCEPTED',
      respondedAt: hoursFromNow(-1),
    },
  });

  await prisma.matchInvitation.upsert({
    where: { id: SEED_IDS.invitations.rejected },
    update: {
      matchId: SEED_IDS.matches.organizing,
      invitedUserId: valentina.id,
      invitedById: juan.id,
      position: null,
      status: 'REJECTED',
      respondedAt: hoursFromNow(-2),
    },
    create: {
      id: SEED_IDS.invitations.rejected,
      matchId: SEED_IDS.matches.organizing,
      invitedUserId: valentina.id,
      invitedById: juan.id,
      position: null,
      status: 'REJECTED',
      respondedAt: hoursFromNow(-2),
    },
  });

  await prisma.matchInvitation.upsert({
    where: { id: SEED_IDS.invitations.cancelled },
    update: { matchId: SEED_IDS.matches.pendingSchedule, invitedUserId: valentina.id, invitedById: juan.id, position: null, status: 'CANCELLED' },
    create: {
      id: SEED_IDS.invitations.cancelled,
      matchId: SEED_IDS.matches.pendingSchedule,
      invitedUserId: valentina.id,
      invitedById: juan.id,
      position: null,
      status: 'CANCELLED',
    },
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

  // A short exchange on the FULL match (organizer + a confirmed participant),
  // and a single post-match message on the match completed within 24h, kept
  // deliberately small — just enough to exercise the chat with real data.
  await prisma.matchChatMessage.upsert({
    where: { id: SEED_IDS.chatMessages.fullMatchWelcome },
    update: { matchId: SEED_IDS.matches.full, authorId: juan.id, content: 'Che, nos vemos en la cancha. ¡Lleven algo para tomar!' },
    create: {
      id: SEED_IDS.chatMessages.fullMatchWelcome,
      matchId: SEED_IDS.matches.full,
      authorId: juan.id,
      content: 'Che, nos vemos en la cancha. ¡Lleven algo para tomar!',
      createdAt: hoursFromNow(-1),
    },
  });

  await prisma.matchChatMessage.upsert({
    where: { id: SEED_IDS.chatMessages.fullMatchReply },
    update: { matchId: SEED_IDS.matches.full, authorId: martin.id, content: 'Dale, ahí llevo yo.' },
    create: {
      id: SEED_IDS.chatMessages.fullMatchReply,
      matchId: SEED_IDS.matches.full,
      authorId: martin.id,
      content: 'Dale, ahí llevo yo.',
      createdAt: hoursFromNow(-0.9),
    },
  });

  await prisma.matchChatMessage.upsert({
    where: { id: SEED_IDS.chatMessages.completedMatchThanks },
    update: { matchId: SEED_IDS.matches.completed, authorId: juan.id, content: 'Buen partido de hoy, ¡nos vemos la próxima!' },
    create: {
      id: SEED_IDS.chatMessages.completedMatchThanks,
      matchId: SEED_IDS.matches.completed,
      authorId: juan.id,
      content: 'Buen partido de hoy, ¡nos vemos la próxima!',
      createdAt: hoursFromNow(-1.9),
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
