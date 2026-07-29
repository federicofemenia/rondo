import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import type { AuthAdapter } from '../infrastructure/auth/authAdapter.js';
import { syncUserFromClerk } from '../modules/users/users.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: User;
  }

  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export function attachAuth(app: FastifyInstance, authAdapter: AuthAdapter): void {
  app.decorateRequest('currentUser', undefined);

  app.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await authAdapter.authenticate(request.headers.authorization);

    if (!profile) {
      await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication token.' } });
      return;
    }

    request.currentUser = await syncUserFromClerk(profile);
  });
}
