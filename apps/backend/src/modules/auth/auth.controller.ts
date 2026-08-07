import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthSessionDto, AuthUserDto } from '@rondo/contracts';
import { changePasswordInputSchema, loginInputSchema, logoutInputSchema, registerInputSchema } from '@rondo/contracts';
import type { User } from '@prisma/client';
import { MatchServiceError } from '../matches/errors.js';
import { deleteSubscription } from '../push/push.service.js';
import type { SessionCookieEnv } from '../../infrastructure/auth/sessionCookie.js';
import { clearedSessionCookieOptions, sessionCookieOptions } from '../../infrastructure/auth/sessionCookie.js';
import { changePassword, loginUser, logoutSession, registerUser } from './auth.service.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

export function registerAuthRoutes(app: FastifyInstance, env: SessionCookieEnv): void {
  const rateLimitConfig = {
    max: 10,
    timeWindow: '1 minute',
    // Rate-limited by IP+username together so one abusive IP hammering many
    // different usernames and many IPs hammering one username are both
    // caught, without a single shared office/NAT IP locking everyone out of
    // their own accounts.
    keyGenerator: (request: { ip: string; body?: unknown }) => {
      const body = request.body as { username?: unknown } | undefined;
      const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
      return `${request.ip}:${username}`;
    },
  };

  app.post<{ Body: unknown }>('/api/v1/auth/register', { config: { rateLimit: rateLimitConfig } }, async (request, reply) => {
    const parsed = registerInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Datos de registro inválidos.', details: parsed.error.issues } });
    }

    try {
      const { user, token } = await registerUser(parsed.data, request.headers['user-agent'] ?? null);
      // Not awaited: setCookie() returns `reply` itself for chaining, not a
      // Promise -- awaiting it hangs forever (the returned FastifyReply is
      // treated as a thenable and its `.then` never resolves).
      reply.setCookie(env.SESSION_COOKIE_NAME, token, sessionCookieOptions(env));
      const body: AuthSessionDto = { authenticated: true, user: toAuthUserDto(user) };
      return reply.code(201).send({ data: body });
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.post<{ Body: unknown }>('/api/v1/auth/login', { config: { rateLimit: rateLimitConfig } }, async (request, reply) => {
    const parsed = loginInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Usuario y contraseña son obligatorios.', details: parsed.error.issues } });
    }

    try {
      const { user, token } = await loginUser(parsed.data, request.headers['user-agent'] ?? null);
      reply.setCookie(env.SESSION_COOKIE_NAME, token, sessionCookieOptions(env));
      const body: AuthSessionDto = { authenticated: true, user: toAuthUserDto(user) };
      return { data: body };
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.post<{ Body: unknown }>('/api/v1/auth/logout', async (request, reply) => {
    const parsed = logoutInputSchema.safeParse(request.body ?? {});
    const pushEndpoint = parsed.success ? parsed.data.pushEndpoint : undefined;

    // Soft lookup, not requireAuth: logout must respond 200 even when the
    // cookie is missing, expired, or already revoked -- there is no
    // "wrong" state to log out from.
    const result = await app.authenticate(request);

    if (result) {
      await logoutSession(result.sessionId);
      if (pushEndpoint) {
        // Best-effort: a shared device's push subscription must never keep
        // pointing at a user who just logged out, but a failure here (e.g.
        // the endpoint was already removed) must never block the logout
        // itself from completing.
        try {
          await deleteSubscription(result.user.id, pushEndpoint);
        } catch {
          // swallowed deliberately -- see comment above.
        }
      }
    }

    reply.clearCookie(env.SESSION_COOKIE_NAME, clearedSessionCookieOptions(env));
    return reply.code(200).send({ data: { authenticated: false, user: null } satisfies AuthSessionDto });
  });

  app.get('/api/v1/auth/session', async (request) => {
    const result = await app.authenticate(request);
    const body: AuthSessionDto = { authenticated: Boolean(result), user: result ? toAuthUserDto(result.user) : null };
    return { data: body };
  });

  app.post<{ Body: unknown }>('/api/v1/auth/change-password', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser || !request.currentSessionId) {
      return reply;
    }

    const parsed = changePasswordInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Datos inválidos.', details: parsed.error.issues } });
    }

    try {
      await changePassword(request.currentUser.id, request.currentSessionId, parsed.data);
      return reply.code(204).send();
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });
}
