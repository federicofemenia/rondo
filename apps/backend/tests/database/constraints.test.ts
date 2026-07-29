import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';

beforeAll(async () => {
  await runSeed();
});

describe('unique constraints', () => {
  it('rejects a duplicate Club.code', async () => {
    await expect(
      prisma.club.create({
        data: { code: 'senor-pato', name: 'Otro club', timezone: 'America/Argentina/Buenos_Aires' },
      }),
    ).rejects.toThrow();
  });

  it('rejects a duplicate Sport.code', async () => {
    await expect(
      prisma.sport.create({ data: { code: 'football', name: 'Otro deporte', displayOrder: 99 } }),
    ).rejects.toThrow();
  });

  it('rejects a duplicate SportModality.code', async () => {
    await expect(
      prisma.sportModality.create({
        data: {
          sportId: SEED_IDS.sports.football,
          code: 'football-5',
          name: 'Otra modalidad',
          playersCount: 1,
          displayOrder: 99,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects a duplicate Court code within the same club', async () => {
    await expect(
      prisma.court.create({
        data: {
          clubId: SEED_IDS.club.senorPato,
          sportModalityId: SEED_IDS.modalities.football5,
          code: 'padel-1',
          name: 'Duplicada',
          displayOrder: 99,
          slotDurationMinutes: 60,
          pricePerHour: 1000,
        },
      }),
    ).rejects.toThrow();
  });

  it('allows the same Court code to be reused in a different club', async () => {
    const otherClub = await prisma.club.create({
      data: { code: 'test-other-club', name: 'Otro club de prueba', timezone: 'America/Argentina/Buenos_Aires' },
    });

    try {
      const court = await prisma.court.create({
        data: {
          clubId: otherClub.id,
          sportModalityId: SEED_IDS.modalities.football5,
          code: 'padel-1',
          name: 'Pádel 1 (otro club)',
          displayOrder: 1,
          slotDurationMinutes: 60,
          pricePerHour: 1000,
        },
      });

      expect(court.code).toBe('padel-1');
    } finally {
      await prisma.court.deleteMany({ where: { clubId: otherClub.id } });
      await prisma.club.delete({ where: { id: otherClub.id } });
    }
  });
});
