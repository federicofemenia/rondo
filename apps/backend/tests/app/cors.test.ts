import { describe, expect, it } from 'vitest';
import { buildAllowedOrigins, createCorsOriginValidator } from '../../src/app/cors.js';
import { buildServer } from '../../src/app/server.js';

describe('buildAllowedOrigins', () => {
  it('always includes the local dev origin', () => {
    expect(buildAllowedOrigins(undefined)).toEqual(['http://localhost:5173']);
  });

  it('adds the configured frontend origin alongside localhost', () => {
    expect(buildAllowedOrigins('https://rondo-beta.vercel.app')).toEqual([
      'http://localhost:5173',
      'https://rondo-beta.vercel.app',
    ]);
  });

  it('does not duplicate the frontend origin when it equals localhost', () => {
    expect(buildAllowedOrigins('http://localhost:5173')).toEqual(['http://localhost:5173']);
  });

  it('strips a trailing slash from the configured frontend origin', () => {
    expect(buildAllowedOrigins('https://rondo-beta.vercel.app/')).toEqual([
      'http://localhost:5173',
      'https://rondo-beta.vercel.app',
    ]);
  });

  it('strips multiple trailing slashes from the configured frontend origin', () => {
    expect(buildAllowedOrigins('https://rondo-beta.vercel.app///')).toEqual([
      'http://localhost:5173',
      'https://rondo-beta.vercel.app',
    ]);
  });

  it('does not alter the local dev origin, which never has a trailing slash', () => {
    expect(buildAllowedOrigins(undefined)).toEqual(['http://localhost:5173']);
  });
});

describe('createCorsOriginValidator', () => {
  const validate = createCorsOriginValidator(['http://localhost:5173', 'https://rondo-beta.vercel.app']);

  it('allows a request with no Origin header (server-to-server, curl)', () => {
    validate(undefined, (error, allow) => {
      expect(error).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it('allows an origin on the allowlist', () => {
    validate('https://rondo-beta.vercel.app', (error, allow) => {
      expect(error).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it('rejects an origin not on the allowlist', () => {
    validate('https://evil.example.com', (error, allow) => {
      expect(error).not.toBeNull();
      expect(allow).toBe(false);
    });
  });

  it('rejects a localhost origin on a different port when allowAnyLocalPort is not set', () => {
    validate('http://localhost:5174', (error, allow) => {
      expect(error).not.toBeNull();
      expect(allow).toBe(false);
    });
  });

  it('allows any localhost/127.0.0.1 port when allowAnyLocalPort is true (Vite falling back off :5173)', () => {
    const validateDev = createCorsOriginValidator(['http://localhost:5173'], { allowAnyLocalPort: true });

    validateDev('http://localhost:5174', (error, allow) => {
      expect(error).toBeNull();
      expect(allow).toBe(true);
    });
    validateDev('http://127.0.0.1:4321', (error, allow) => {
      expect(error).toBeNull();
      expect(allow).toBe(true);
    });
    validateDev('https://evil.example.com', (error, allow) => {
      expect(error).not.toBeNull();
      expect(allow).toBe(false);
    });
  });
});

describe('CORS integration on the built server', () => {
  it('reflects an allowed origin (localhost) in the response headers', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:5173' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    await app.close();
  });

  it('reflects the configured FRONTEND_URL in the response headers', async () => {
    const app = await buildServer({ NODE_ENV: 'test', FRONTEND_URL: 'https://rondo-beta.vercel.app' });
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://rondo-beta.vercel.app' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://rondo-beta.vercel.app');
    await app.close();
  });

  it('does not reflect a disallowed origin in the response headers', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example.com' } });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('still allows the trailing-slash-free origin when FRONTEND_URL was configured with a trailing slash', async () => {
    const app = await buildServer({ NODE_ENV: 'test', FRONTEND_URL: 'https://rondo-beta.vercel.app/' });
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://rondo-beta.vercel.app' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://rondo-beta.vercel.app');
    await app.close();
  });

  it('outside production, reflects any localhost port (Vite auto-fallback off :5173, e.g. a stale process already using it)', async () => {
    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:5174' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5174');
    await app.close();
  });

  it('in production, does not reflect a localhost origin outside :5173', async () => {
    const app = await buildServer({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://rondo-beta.vercel.app',
    });
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:5174' } });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });
});
