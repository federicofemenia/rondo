import { prisma } from '../../src/infrastructure/database/prisma.js';
import type { AuthAdapter, AuthResult } from '../../src/infrastructure/auth/authAdapter.js';

const BEARER_PREFIX = 'Bearer ';

export type TestUserFixture = {
  username: string;
  displayName?: string | null;
  role?: 'USER' | 'SUPERADMIN';
  avatarUrl?: string | null;
};

const FIXTURE_PASSWORD_HASH = 'TEST_FIXTURE_NO_LOGIN';

/**
 * There's no external identity to "sync" from anymore (see
 * sessionAuthAdapter.ts) -- this fake adapter keeps the same "declare a
 * token -> profile map inline" ergonomic controller tests relied on under
 * Clerk by lazily upserting a real User row by username the first time each
 * token is used. Only the row's id is cached (never the row itself): a real
 * request always re-reads `request.currentUser` fresh from the DB, and
 * tests that PUT /me/profile then GET /me in the same test rely on that --
 * caching the User object itself would silently serve stale data (sex,
 * biography, avatarUrl...) from the moment the row was first created.
 */
export function createFakeAuthAdapter(fixturesByToken: Record<string, TestUserFixture>): AuthAdapter {
  const idCache = new Map<string, Promise<string>>();

  function resolveUserId(fixture: TestUserFixture): Promise<string> {
    let pending = idCache.get(fixture.username);
    if (!pending) {
      pending = prisma.user
        .upsert({
          where: { username: fixture.username },
          update: {},
          create: {
            username: fixture.username,
            passwordHash: FIXTURE_PASSWORD_HASH,
            displayName: fixture.displayName ?? fixture.username,
            role: fixture.role ?? 'USER',
            avatarUrl: fixture.avatarUrl ?? null,
          },
        })
        .then((user) => user.id);
      idCache.set(fixture.username, pending);
    }
    return pending;
  }

  return {
    async authenticate(request): Promise<AuthResult | null> {
      const header = request.headers.authorization;
      if (!header?.startsWith(BEARER_PREFIX)) {
        return null;
      }

      const fixture = fixturesByToken[header.slice(BEARER_PREFIX.length)];
      if (!fixture) {
        return null;
      }

      const userId = await resolveUserId(fixture);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return null;
      }

      return { user, sessionId: 'test-session' };
    },
  };
}
