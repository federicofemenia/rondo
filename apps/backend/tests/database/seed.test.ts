import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';

describe('runSeed', () => {
  it('is idempotent: running it twice does not duplicate rows', async () => {
    await runSeed();
    await runSeed();

    const [sportsCount, modalitiesCount, clubsCount, courtsCount, openingHoursCount, newsCount] = await Promise.all([
      prisma.sport.count(),
      prisma.sportModality.count(),
      prisma.club.count(),
      prisma.court.count(),
      prisma.openingHour.count(),
      prisma.clubNews.count(),
    ]);

    expect(sportsCount).toBe(2);
    expect(modalitiesCount).toBe(2);
    expect(clubsCount).toBe(1);
    expect(courtsCount).toBe(4);
    expect(openingHoursCount).toBe(7);
    expect(newsCount).toBe(1);
  });

  it('produces the exact codes and display order specified for Señor Pato', async () => {
    await runSeed();

    const club = await prisma.club.findUniqueOrThrow({ where: { id: SEED_IDS.club.senorPato } });
    expect(club).toMatchObject({ code: 'senor-pato', name: 'Señor Pato' });

    const sports = await prisma.sport.findMany({ orderBy: { displayOrder: 'asc' } });
    expect(sports.map((sport) => ({ code: sport.code, name: sport.name, displayOrder: sport.displayOrder }))).toEqual([
      { code: 'football', name: 'Fútbol', displayOrder: 1 },
      { code: 'padel', name: 'Pádel', displayOrder: 2 },
    ]);

    const courts = await prisma.court.findMany({ where: { clubId: club.id }, orderBy: { displayOrder: 'asc' } });
    expect(courts.map((court) => ({ code: court.code, name: court.name, displayOrder: court.displayOrder }))).toEqual([
      { code: 'padel-1', name: 'Pádel 1', displayOrder: 1 },
      { code: 'padel-2', name: 'Pádel 2', displayOrder: 2 },
      { code: 'padel-3', name: 'Pádel 3', displayOrder: 3 },
      { code: 'football-5', name: 'Fútbol 5', displayOrder: 4 },
    ]);
  });
});
