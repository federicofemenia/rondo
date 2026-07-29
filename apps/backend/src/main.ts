import { buildServer } from './app/server.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await buildServer(env);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
