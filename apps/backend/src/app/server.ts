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
import { createClerkAuthAdapter } from '../infrastructure/auth/clerkAuthAdapter.js';
import type { AuthAdapter } from '../infrastructure/auth/authAdapter.js';
import { attachAuth } from './auth.js';

export interface BuildServerDeps {
  authAdapter?: AuthAdapter;
}

export async function buildServer(env: Pick<Env, 'NODE_ENV' | 'CLERK_SECRET_KEY'>, deps: BuildServerDeps = {}) {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  await app.register(cors, {
    origin: true,
  });

  app.get('/health', async (): Promise<HealthResponse> => ({
    ok: true,
    service: 'rondo-api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/database', async () => getHealthStatus());

  const authAdapter = deps.authAdapter ?? createClerkAuthAdapter(env.CLERK_SECRET_KEY ?? '');
  attachAuth(app, authAdapter);

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

  return app;
}
