import { describe, expect, it } from 'vitest';
import { app } from './server.js';

describe('health endpoints', () => {
  it('returns ok for /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, service: 'rondo-api' });
  });

  it('returns a database status payload for /health/database', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/database' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('status');
  });
});
