import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const ENV_KEYS = [
  'NODE_ENV',
  'PORT',
  'HOST',
  'DATABASE_URL',
  'FRONTEND_URL',
  'SESSION_COOKIE_NAME',
  'SESSION_TTL_DAYS',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe('loadEnv', () => {
  it('defaults NODE_ENV to development, PORT to 3000 and HOST to 0.0.0.0', () => {
    const env = loadEnv();
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe('0.0.0.0');
  });

  it('defaults SESSION_COOKIE_NAME to rondo_session and SESSION_TTL_DAYS to 30', () => {
    const env = loadEnv();
    expect(env.SESSION_COOKIE_NAME).toBe('rondo_session');
    expect(env.SESSION_TTL_DAYS).toBe(30);
  });

  it('reads SESSION_COOKIE_NAME and SESSION_TTL_DAYS when set', () => {
    process.env.SESSION_COOKIE_NAME = 'custom_session';
    process.env.SESSION_TTL_DAYS = '7';

    const env = loadEnv();
    expect(env.SESSION_COOKIE_NAME).toBe('custom_session');
    expect(env.SESSION_TTL_DAYS).toBe(7);
  });

  it('does not require DATABASE_URL or FRONTEND_URL outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(() => loadEnv()).not.toThrow();

    process.env.NODE_ENV = 'test';
    expect(() => loadEnv()).not.toThrow();
  });

  it('throws in production when DATABASE_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';

    expect(() => loadEnv()).toThrow(/DATABASE_URL/);
  });

  it('throws in production when FRONTEND_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';

    expect(() => loadEnv()).toThrow(/FRONTEND_URL/);
  });

  it('throws in production when VAPID_PUBLIC_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:admin@rondo.app';

    expect(() => loadEnv()).toThrow(/VAPID_PUBLIC_KEY/);
  });

  it('throws in production when VAPID_PRIVATE_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_SUBJECT = 'mailto:admin@rondo.app';

    expect(() => loadEnv()).toThrow(/VAPID_PRIVATE_KEY/);
  });

  it('throws in production when VAPID_SUBJECT is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';

    expect(() => loadEnv()).toThrow(/VAPID_SUBJECT/);
  });

  it('succeeds in production when DATABASE_URL, FRONTEND_URL and the VAPID trio are all set', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:admin@rondo.app';

    const env = loadEnv();
    expect(env.NODE_ENV).toBe('production');
  });

  it('reads R2 storage variables when set, and leaves them undefined otherwise', () => {
    expect(loadEnv().R2_BUCKET_NAME).toBeUndefined();

    process.env.R2_ACCOUNT_ID = 'acct123';
    process.env.R2_ACCESS_KEY_ID = 'key123';
    process.env.R2_SECRET_ACCESS_KEY = 'secret123';
    process.env.R2_BUCKET_NAME = 'rondo-avatars';
    process.env.R2_PUBLIC_URL = 'https://avatars.rondo.app';

    const env = loadEnv();
    expect(env.R2_BUCKET_NAME).toBe('rondo-avatars');
    expect(env.R2_PUBLIC_URL).toBe('https://avatars.rondo.app');
  });
});
