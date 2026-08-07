import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { HealthResponse } from '@rondo/contracts';
import type { Env } from '../config/env.js';
import { getHealthStatus } from '../modules/health/health.controller.js';
import { registerUserRoutes } from '../modules/users/users.controller.js';
import { registerSportRoutes } from '../modules/sports/sports.controller.js';
import { registerMatchRoutes } from '../modules/matches/matches.controller.js';
import { registerRatingRoutes } from '../modules/matches/ratings.controller.js';
import { registerPendingTaskRoutes } from '../modules/matches/pendingTasks.controller.js';
import { registerCandidateRoutes } from '../modules/matches/candidates.controller.js';
import { registerInvitationRoutes } from '../modules/matches/invitations.controller.js';
import { registerParticipantRoutes } from '../modules/matches/participants.controller.js';
import { registerMatchChatRoutes } from '../modules/matches/chat.controller.js';
import { registerSportProfileRoutes } from '../modules/sportProfiles/sportProfiles.controller.js';
import { registerPushRoutes } from '../modules/push/push.controller.js';
import { registerAdminRoutes } from '../modules/admin/admin.controller.js';
import { registerAuthRoutes } from '../modules/auth/auth.controller.js';
import { configureWebPush } from '../modules/push/push.service.js';
import { createSessionAuthAdapter } from '../infrastructure/auth/sessionAuthAdapter.js';
import { createR2AvatarStorage } from '../infrastructure/storage/r2AvatarStorage.js';
import type { AuthAdapter } from '../infrastructure/auth/authAdapter.js';
import { attachAuth } from './auth.js';
import { buildAllowedOrigins, createCorsOriginValidator } from './cors.js';
import { createOriginGuard } from './csrf.js';

export interface BuildServerDeps {
  authAdapter?: AuthAdapter;
}

type BuildServerEnv = Pick<
  Env,
  'NODE_ENV' | 'FRONTEND_URL' | 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT' | 'R2_ACCOUNT_ID' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY' | 'R2_BUCKET_NAME' | 'R2_PUBLIC_URL'
> &
  // Optional here (unlike loadEnv()'s output, where zod's .default() already
  // fills these in) so ad-hoc test calls like buildServer({ NODE_ENV: 'test' })
  // don't need to spell out every auth-cookie setting -- the same defaults
  // env.ts's schema uses are applied below instead.
  Partial<Pick<Env, 'SESSION_COOKIE_NAME' | 'SESSION_TTL_DAYS'>>;

const DEFAULT_SESSION_COOKIE_NAME = 'rondo_session';
const DEFAULT_SESSION_TTL_DAYS = 30;

export async function buildServer(rawEnv: BuildServerEnv, deps: BuildServerDeps = {}) {
  const env = {
    ...rawEnv,
    SESSION_COOKIE_NAME: rawEnv.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME,
    SESSION_TTL_DAYS: rawEnv.SESSION_TTL_DAYS ?? DEFAULT_SESSION_TTL_DAYS,
  };

  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  configureWebPush({
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: env.VAPID_SUBJECT,
  });

  const allowedOrigins = buildAllowedOrigins(env.FRONTEND_URL);
  const allowAnyLocalPort = env.NODE_ENV !== 'production';

  // Registered BEFORE @fastify/cors, deliberately: this app's CORS origin
  // validator hard-rejects any disallowed origin with a raw 500 (it treats
  // the validator's Error as a request error, for every method, not just
  // mutating ones) -- registering the CSRF guard first means a mutating
  // request from a disallowed origin gets a clean, intentional 403 from
  // here, rather than an incidental 500 from CORS. GET/HEAD and
  // allowed-origin requests pass straight through to CORS unaffected. See
  // csrf.ts's doc comment for why cookie-based auth needs this independent
  // of CORS at all (CORS controls response *readability*, not whether the
  // server processes the mutation).
  app.addHook('onRequest', createOriginGuard(allowedOrigins, { allowAnyLocalPort }));

  await app.register(cors, {
    origin: createCorsOriginValidator(allowedOrigins, { allowAnyLocalPort }),
    // The session cookie must actually travel on cross-origin XHR/fetch
    // calls (e.g. hitting Render directly, or any origin not proxied
    // same-origin) for those callers to authenticate at all.
    credentials: true,
  });

  await app.register(cookie);

  // Opt-in per-route (global: false) -- only /auth/register and /auth/login
  // attach a rateLimit config, everything else is unaffected.
  await app.register(rateLimit, { global: false });

  app.get('/health', async (): Promise<HealthResponse> => ({
    ok: true,
    service: 'rondo-api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/database', async () => getHealthStatus());

  const authAdapter =
    deps.authAdapter ??
    createSessionAuthAdapter({ NODE_ENV: env.NODE_ENV, SESSION_COOKIE_NAME: env.SESSION_COOKIE_NAME, SESSION_TTL_DAYS: env.SESSION_TTL_DAYS });
  attachAuth(app, authAdapter);

  const avatarStorage = createR2AvatarStorage(env);

  registerAuthRoutes(app, { NODE_ENV: env.NODE_ENV, SESSION_COOKIE_NAME: env.SESSION_COOKIE_NAME, SESSION_TTL_DAYS: env.SESSION_TTL_DAYS });
  registerUserRoutes(app, avatarStorage);
  registerSportRoutes(app);
  registerMatchRoutes(app);
  registerRatingRoutes(app);
  registerPendingTaskRoutes(app);
  registerSportProfileRoutes(app);
  registerCandidateRoutes(app);
  registerInvitationRoutes(app);
  registerParticipantRoutes(app);
  registerMatchChatRoutes(app);
  registerPushRoutes(app);
  registerAdminRoutes(app);

  return app;
}
