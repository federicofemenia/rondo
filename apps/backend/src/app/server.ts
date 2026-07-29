import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { HealthResponse } from '@rondo/contracts';
import type { Env } from '../config/env.js';
import { getHealthStatus } from '../modules/health/health.controller.js';

export async function buildServer(env: Pick<Env, 'NODE_ENV'>) {
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

  return app;
}
