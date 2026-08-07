import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

export interface AuthResult {
  user: User;
  /** The Session row's id -- needed by change-password to revoke every OTHER session without invalidating the one making the request. */
  sessionId: string;
}

export interface AuthAdapter {
  authenticate(request: FastifyRequest): Promise<AuthResult | null>;
}
