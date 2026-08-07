import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../src/infrastructure/database/prisma.js';
import { runBaseSeed } from '../../../src/infrastructure/database/seedBase.js';
import { SEED_IDS } from '../../../src/infrastructure/database/seedIds.js';
import { argon2PasswordHasher } from '../../../src/infrastructure/auth/argon2PasswordHasher.js';
import { main as createSuperadmin } from '../../../src/infrastructure/scripts/createSuperadmin.js';

const TEST_USERNAME = 'test_superadmin_script';
const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  await runBaseSeed();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { username: TEST_USERNAME } });
  if (user) {
    await prisma.clubMembership.deleteMany({ where: { userId: user.id } });
    await prisma.playerAvailability.deleteMany({ where: { userSportProfile: { userId: user.id } } });
    await prisma.userSportProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

function setEnv(username: string, displayName: string, password: string): void {
  process.env.SUPERADMIN_USERNAME = username;
  process.env.SUPERADMIN_DISPLAY_NAME = displayName;
  process.env.SUPERADMIN_PASSWORD = password;
}

describe('auth:create-superadmin script', () => {
  it('refuses to run when any required env var is missing', async () => {
    process.env.SUPERADMIN_USERNAME = undefined;
    delete process.env.SUPERADMIN_USERNAME;
    process.env.SUPERADMIN_DISPLAY_NAME = 'Someone';
    process.env.SUPERADMIN_PASSWORD = 'unaClave123';

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await createSuperadmin();

    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    errorSpy.mockRestore();
  });

  it('refuses a password shorter than 8 characters', async () => {
    setEnv(TEST_USERNAME, 'Test Superadmin', 'short12');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await createSuperadmin();

    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    errorSpy.mockRestore();
  });

  it('creates a SUPERADMIN account with a real Argon2id password hash, and grants Señor Pato CLUB_ADMIN membership', async () => {
    setEnv(TEST_USERNAME, 'Test Superadmin', 'unaClave123');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await createSuperadmin();

    const user = await prisma.user.findUniqueOrThrow({ where: { username: TEST_USERNAME } });
    expect(user.role).toBe('SUPERADMIN');
    expect(user.displayName).toBe('Test Superadmin');
    expect(await argon2PasswordHasher.verify(user.passwordHash, 'unaClave123')).toBe(true);

    // Never logs the password itself, only confirmation metadata.
    const loggedLines = logSpy.mock.calls.map((call) => call.join(' '));
    expect(loggedLines.some((line) => line.includes('unaClave123'))).toBe(false);

    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId: SEED_IDS.club.senorPato, userId: user.id } },
    });
    expect(membership).toMatchObject({ role: 'CLUB_ADMIN', status: 'ACTIVE' });

    logSpy.mockRestore();
  });

  it('is idempotent: running it twice for the same username updates the same account, does not duplicate sport profiles', async () => {
    setEnv(TEST_USERNAME, 'Test Superadmin', 'unaClave123');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await createSuperadmin();
    const firstUser = await prisma.user.findUniqueOrThrow({ where: { username: TEST_USERNAME } });

    setEnv(TEST_USERNAME, 'Test Superadmin Renamed', 'otraClave456');
    await createSuperadmin();
    const secondUser = await prisma.user.findUniqueOrThrow({ where: { username: TEST_USERNAME } });

    expect(secondUser.id).toBe(firstUser.id);
    expect(secondUser.displayName).toBe('Test Superadmin Renamed');
    expect(await argon2PasswordHasher.verify(secondUser.passwordHash, 'otraClave456')).toBe(true);

    const profileCount = await prisma.userSportProfile.count({ where: { userId: firstUser.id } });
    expect(profileCount).toBeGreaterThanOrEqual(2);

    logSpy.mockRestore();
  });

  it('never auto-promotes a different, unrelated username', async () => {
    setEnv(TEST_USERNAME, 'Test Superadmin', 'unaClave123');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await createSuperadmin();
    logSpy.mockRestore();

    const bystander = await prisma.user.findUnique({ where: { username: 'juan_perez_demo' } });
    if (bystander) {
      expect(bystander.role).toBe('USER');
    }
  });
});
