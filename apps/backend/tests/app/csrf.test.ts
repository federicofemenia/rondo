import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';

describe('CSRF Origin guard', () => {
  it('rejects a mutative request whose Origin header is not our own frontend', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'https://evil.example.com' },
      payload: { username: 'whoever', password: 'whatever' },
    });

    expect(response.statusCode).toBe(403);
    expect((response.json() as { error: { code: string } }).error.code).toBe('CSRF_ORIGIN_REJECTED');
    await app.close();
  });

  it('allows a mutative request whose Origin is the local dev frontend', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'http://localhost:5173' },
      payload: { username: 'whoever', password: 'whatever' },
    });

    // Reaches the real handler (401 invalid credentials), not the CSRF guard.
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('allows a mutative request whose Origin is the configured FRONTEND_URL', async () => {
    const app = await buildServer({ NODE_ENV: 'test', FRONTEND_URL: 'https://rondo-beta.vercel.app' });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'https://rondo-beta.vercel.app' },
      payload: { username: 'whoever', password: 'whatever' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('never blocks a request with no Origin header at all (server-to-server, health checks)', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('never adds its own blocking for GET requests (only mutative methods are checked)', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { origin: 'http://localhost:5173' } });

    // Reaches the real handler untouched by the CSRF guard -- CORS's own
    // (separate) origin allowlist is exercised in cors.test.ts, not here.
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('in production, does not allow a localhost origin outside :5173', async () => {
    const app = await buildServer({ NODE_ENV: 'production', FRONTEND_URL: 'https://rondo-beta.vercel.app' });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'http://localhost:5174' },
      payload: { username: 'whoever', password: 'whatever' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
