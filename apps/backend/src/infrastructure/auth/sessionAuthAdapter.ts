import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuthAdapter } from './authAdapter.js';
import { hashSessionToken } from './sessionTokens.js';
import type { SessionCookieEnv } from './sessionCookie.js';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function createSessionAuthAdapter(env: SessionCookieEnv): AuthAdapter {
  return {
    async authenticate(request) {
      const token = request.cookies[env.SESSION_COOKIE_NAME];
      if (!token) {
        return null;
      }

      const tokenHash = hashSessionToken(token);
      const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });

      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        return null;
      }

      // Bounds write amplification to at most one update per active session
      // every 5 minutes, regardless of request volume, instead of writing
      // on literally every authenticated request.
      const now = new Date();
      if (now.getTime() - session.lastUsedAt.getTime() > STALE_THRESHOLD_MS) {
        await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
      }

      return { user: session.user, sessionId: session.id };
    },
  };
}
