import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../src/infrastructure/database/prisma.js';
import { runBaseSeed } from '../../../src/infrastructure/database/seedBase.js';
import { REQUIRED_CONFIRMATION, runReset } from '../../../src/infrastructure/scripts/resetUserData.js';

let testUserId: string;

beforeAll(async () => {
  await runBaseSeed();
  const user = await prisma.user.create({
    data: { username: `test_reset_${randomUUID().slice(0, 8)}`, passwordHash: 'TEST_FIXTURE_NO_LOGIN' },
  });
  testUserId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: testUserId } });
});

function silence() {
  return { log: vi.spyOn(console, 'log').mockImplementation(() => {}), error: vi.spyOn(console, 'error').mockImplementation(() => {}) };
}

describe('beta:reset-user-data', () => {
  it('dry-run (default) never deletes anything', async () => {
    const spies = silence();
    const outcome = await runReset({ execute: false, allowDestructiveEnvVar: undefined, confirmationEnvVar: undefined });

    expect(outcome.status).toBe('dry-run');
    const stillExists = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(stillExists).not.toBeNull();

    spies.log.mockRestore();
    spies.error.mockRestore();
  });

  it('refuses to execute without ALLOW_DESTRUCTIVE_BETA_RESET=true, even with --execute and the right confirmation', async () => {
    const spies = silence();
    const outcome = await runReset({ execute: true, allowDestructiveEnvVar: undefined, confirmationEnvVar: REQUIRED_CONFIRMATION });

    expect(outcome.status).toBe('refused');
    const stillExists = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(stillExists).not.toBeNull();

    spies.log.mockRestore();
    spies.error.mockRestore();
  });

  it('refuses to execute with the wrong BETA_RESET_CONFIRMATION value', async () => {
    const spies = silence();
    const outcome = await runReset({ execute: true, allowDestructiveEnvVar: 'true', confirmationEnvVar: 'WRONG' });

    expect(outcome.status).toBe('refused');
    const stillExists = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(stillExists).not.toBeNull();

    spies.log.mockRestore();
    spies.error.mockRestore();
  });

  // Deliberately NOT run by default: runReset({execute:true}) deletes every
  // User/Match/etc row in whatever database DATABASE_URL points at, with no
  // per-row filter -- against this repo's shared local rondo_dev database
  // (the same one `pnpm test` normally runs against), that would silently
  // wipe real local dev data on every `pnpm test`. Opt in explicitly
  // (RUN_DESTRUCTIVE_RESET_TEST=true), ideally only against a disposable
  // database, to exercise the real deletion path.
  it.skipIf(process.env.RUN_DESTRUCTIVE_RESET_TEST !== 'true')(
    'preserves Sport, SportModality, Club, Court, OpeningHour, ClubNews and PushEvent when it actually executes',
    async () => {
      const spies = silence();

      const [sportsBefore, clubsBefore, courtsBefore] = await Promise.all([prisma.sport.count(), prisma.club.count(), prisma.court.count()]);
      expect(sportsBefore).toBeGreaterThan(0);
      expect(clubsBefore).toBeGreaterThan(0);
      expect(courtsBefore).toBeGreaterThan(0);

      const outcome = await runReset({ execute: true, allowDestructiveEnvVar: 'true', confirmationEnvVar: REQUIRED_CONFIRMATION });
      expect(outcome.status).toBe('executed');

      const [sportsAfter, clubsAfter, courtsAfter] = await Promise.all([prisma.sport.count(), prisma.club.count(), prisma.court.count()]);
      expect(sportsAfter).toBe(sportsBefore);
      expect(clubsAfter).toBe(clubsBefore);
      expect(courtsAfter).toBe(courtsBefore);

      const remainingUser = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(remainingUser).toBeNull();

      spies.log.mockRestore();
      spies.error.mockRestore();

      // runBaseSeed is idempotent -- reseed so later test files in the same
      // run (and any subsequent local test run against this DB) still see
      // catalog data, exactly as the real deploy sequence does (seed:base
      // after a real reset, per docs/AUTHENTICATION.md).
      await runBaseSeed();
    },
  );
});
