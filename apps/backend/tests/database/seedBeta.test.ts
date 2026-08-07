import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runBaseSeed } from '../../src/infrastructure/database/seedBase.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';

// seedBeta.ts only exports a self-invoking script (by design: it is a
// manual, one-off tool, not something other modules import), so these
// tests exercise the same lookup-by-username + upsert-profile behavior
// directly, against a throwaway username.
async function attachDemoFootballProfile(username: string): Promise<void> {
  const football = await prisma.sport.findUniqueOrThrow({ where: { code: 'football' } });
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return;
  }
  await prisma.userSportProfile.upsert({
    where: { userId_sportId: { userId: user.id, sportId: football.id } },
    update: {},
    create: { userId: user.id, sportId: football.id, positions: ['Defensor', 'Mediocampista'], isAvailableForInvitations: true },
  });
}

describe('seedBeta behavior', () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await runBaseSeed();
  });

  afterEach(async () => {
    await Promise.all(
      createdUserIds.splice(0).map((userId) => prisma.userSportProfile.deleteMany({ where: { userId } }).then(() => prisma.user.delete({ where: { id: userId } }))),
    );
  });

  it('skips a username with no synced account, without creating anything', async () => {
    await expect(attachDemoFootballProfile(`nonexistent-${randomUUID()}`)).resolves.toBeUndefined();
  });

  it('attaches a demo football profile to an already-synced user found by username', async () => {
    const username = `tester-${randomUUID()}`;
    const user = await prisma.user.create({ data: { username, passwordHash: 'TEST_FIXTURE_NO_LOGIN' } });
    createdUserIds.push(user.id);

    await attachDemoFootballProfile(username);

    const profile = await prisma.userSportProfile.findUnique({
      where: { userId_sportId: { userId: user.id, sportId: SEED_IDS.sports.football } },
    });
    expect(profile).not.toBeNull();
    expect(profile?.positions).toEqual(['Defensor', 'Mediocampista']);
  });

  it('is idempotent: running it twice does not duplicate the profile', async () => {
    const username = `tester-${randomUUID()}`;
    const user = await prisma.user.create({ data: { username, passwordHash: 'TEST_FIXTURE_NO_LOGIN' } });
    createdUserIds.push(user.id);

    await attachDemoFootballProfile(username);
    await attachDemoFootballProfile(username);

    const count = await prisma.userSportProfile.count({ where: { userId: user.id } });
    expect(count).toBe(1);
  });
});
