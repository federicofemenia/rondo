import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runBaseSeed } from '../../src/infrastructure/database/seedBase.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';

describe('runBaseSeed', () => {
  it('creates the catalog data standalone, without touching users or matches', async () => {
    const result = await runBaseSeed();

    expect(result.club.id).toBe(SEED_IDS.club.senorPato);
    expect(result.courts).toHaveLength(4);
  });

  it('is idempotent on its own: running it twice does not duplicate rows', async () => {
    await runBaseSeed();
    await runBaseSeed();

    const [sportsCount, courtsCount] = await Promise.all([prisma.sport.count(), prisma.court.count()]);
    expect(sportsCount).toBe(2);
    expect(courtsCount).toBe(4);
  });
});
