import { prisma } from '../../infrastructure/database/prisma.js';

export async function getHealthStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // Logged server-side only: a Prisma connection error can include the DB
    // host, which the public response must not expose.
    console.error('Database health check failed:', error instanceof Error ? error.message : error);

    return {
      status: 'degraded',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
