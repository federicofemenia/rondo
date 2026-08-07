import type { FastifyReply, FastifyRequest } from 'fastify';
import { isOriginAllowed, type OriginAllowlistOptions } from './cors.js';

const MUTATIVE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Cookie-based auth means CORS alone isn't enough defense: a browser will
 * still send the cookie cross-site for a simple form POST (CORS only blocks
 * the attacker page from *reading* the response, not from *causing* the
 * mutation). This hook rejects any mutative request whose Origin header is
 * present but not our own allowlisted frontend — mirroring CORS's own
 * rationale for requests with no Origin header at all (server-to-server
 * calls, health checks) always passing through untouched.
 */
export function createOriginGuard(allowedOrigins: string[], options: OriginAllowlistOptions = {}) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!MUTATIVE_METHODS.has(request.method)) {
      return;
    }

    const origin = request.headers.origin;
    if (!origin || isOriginAllowed(origin, allowedOrigins, options)) {
      return;
    }

    await reply.code(403).send({ error: { code: 'CSRF_ORIGIN_REJECTED', message: 'Origin not allowed for this request.' } });
  };
}
