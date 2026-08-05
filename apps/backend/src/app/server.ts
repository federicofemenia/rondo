import Fastify from 'fastify';
import cors from '@fastify/cors';
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
import { configureWebPush } from '../modules/push/push.service.js';
import { createClerkAuthAdapter } from '../infrastructure/auth/clerkAuthAdapter.js';
import type { AuthAdapter } from '../infrastructure/auth/authAdapter.js';
import { attachAuth } from './auth.js';
import { buildAllowedOrigins, createCorsOriginValidator } from './cors.js';

export interface BuildServerDeps {
  authAdapter?: AuthAdapter;
}

type BuildServerEnv = Pick<
  Env,
  | 'NODE_ENV'
  | 'CLERK_SECRET_KEY'
  | 'FRONTEND_URL'
  | 'BOOTSTRAP_ADMIN_CLERK_USER_ID'
  | 'BOOTSTRAP_ADMIN_USERNAME'
  | 'VAPID_PUBLIC_KEY'
  | 'VAPID_PRIVATE_KEY'
  | 'VAPID_SUBJECT'
>;

export async function buildServer(env: BuildServerEnv, deps: BuildServerDeps = {}) {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  configureWebPush({
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: env.VAPID_SUBJECT,
  });

  await app.register(cors, {
    origin: createCorsOriginValidator(buildAllowedOrigins(env.FRONTEND_URL), { allowAnyLocalPort: env.NODE_ENV !== 'production' }),
  });

  app.get('/health', async (): Promise<HealthResponse> => ({
    ok: true,
    service: 'rondo-api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/database', async () => getHealthStatus());

  const authAdapter = deps.authAdapter ?? createClerkAuthAdapter(env.CLERK_SECRET_KEY ?? '');
  attachAuth(app, authAdapter, {
    clerkUserId: env.BOOTSTRAP_ADMIN_CLERK_USER_ID,
    username: env.BOOTSTRAP_ADMIN_USERNAME,
  });

  registerUserRoutes(app);
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

  return app;
}
