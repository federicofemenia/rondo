import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import type { AuthAdapter, AuthResult } from '../infrastructure/auth/authAdapter.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: User;
    /** The Session row backing this request, if any -- only change-password needs it (to revoke every OTHER session without invalidating this one). */
    currentSessionId?: string;
  }

  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Non-throwing lookup, for routes that must work whether or not the caller is authenticated (GET /auth/session, POST /auth/logout). */
    authenticate: (request: FastifyRequest) => Promise<AuthResult | null>;
  }
}

export function attachAuth(app: FastifyInstance, authAdapter: AuthAdapter): void {
  app.decorateRequest('currentUser', undefined);
  app.decorateRequest('currentSessionId', undefined);

  app.decorate('authenticate', (request: FastifyRequest) => authAdapter.authenticate(request));

  app.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await authAdapter.authenticate(request);

    if (!result) {
      await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session.' } });
      return;
    }

    request.currentUser = result.user;
    request.currentSessionId = result.sessionId;
  });
}
