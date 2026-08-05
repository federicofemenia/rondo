import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const ENV_KEYS = [
  'NODE_ENV',
  'PORT',
  'HOST',
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'FRONTEND_URL',
  'BOOTSTRAP_ADMIN_CLERK_USER_ID',
  'BOOTSTRAP_ADMIN_USERNAME',
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

  it('does not require DATABASE_URL, CLERK_SECRET_KEY or FRONTEND_URL outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(() => loadEnv()).not.toThrow();

    process.env.NODE_ENV = 'test';
    expect(() => loadEnv()).not.toThrow();
  });

  it('throws in production when DATABASE_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';

    expect(() => loadEnv()).toThrow(/DATABASE_URL/);
  });

  it('throws in production when CLERK_SECRET_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';

    expect(() => loadEnv()).toThrow(/CLERK_SECRET_KEY/);
  });

  it('throws in production when FRONTEND_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';

    expect(() => loadEnv()).toThrow(/FRONTEND_URL/);
  });

  it('throws in production when VAPID_PUBLIC_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:admin@rondo.app';

    expect(() => loadEnv()).toThrow(/VAPID_PUBLIC_KEY/);
  });

  it('throws in production when VAPID_PRIVATE_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_SUBJECT = 'mailto:admin@rondo.app';

    expect(() => loadEnv()).toThrow(/VAPID_PRIVATE_KEY/);
  });

  it('throws in production when VAPID_SUBJECT is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';

    expect(() => loadEnv()).toThrow(/VAPID_SUBJECT/);
  });

  it('succeeds in production when DATABASE_URL, CLERK_SECRET_KEY, FRONTEND_URL and the VAPID trio are all set', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.FRONTEND_URL = 'https://rondo-beta.vercel.app';
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:admin@rondo.app';

    const env = loadEnv();
    expect(env.NODE_ENV).toBe('production');
  });

  it('reads BOOTSTRAP_ADMIN_CLERK_USER_ID and BOOTSTRAP_ADMIN_USERNAME when set', () => {
    process.env.BOOTSTRAP_ADMIN_CLERK_USER_ID = 'user_abc123';
    process.env.BOOTSTRAP_ADMIN_USERNAME = 'fede';

    const env = loadEnv();
    expect(env.BOOTSTRAP_ADMIN_CLERK_USER_ID).toBe('user_abc123');
    expect(env.BOOTSTRAP_ADMIN_USERNAME).toBe('fede');
  });
});
