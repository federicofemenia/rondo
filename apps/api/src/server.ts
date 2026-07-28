import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadEnv } from './env.js';
import { getHealthStatus } from './modules/health/health.controller.js';

const env = loadEnv();

const app = Fastify({
  logger: env.NODE_ENV !== 'test',
});

await app.register(cors, {
  origin: true,
});

app.get('/health', async () => ({
  ok: true,
  service: 'rondo-api',
  timestamp: new Date().toISOString(),
}));

app.get('/health/database', async () => getHealthStatus());

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  await start();
}

export { app, start };
