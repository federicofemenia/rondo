import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';

describe('health endpoints', () => {
  it('returns ok for /health', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, service: 'rondo-api' });
  });

  it('returns a database status payload for /health/database', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({ method: 'GET', url: '/health/database' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('status');
  });
});
