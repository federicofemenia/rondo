import type { CookieSerializeOptions } from '@fastify/cookie';

const SECONDS_PER_DAY = 86_400;

export type SessionCookieEnv = {
  NODE_ENV: 'development' | 'test' | 'production';
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_DAYS: number;
};

/**
 * Same attributes for setting and clearing the cookie (maxAge differs: a
 * positive value to set it, 0 to clear it) -- httpOnly/secure/sameSite/path
 * must match exactly on both, or a browser can end up with two cookies of
 * the same name under slightly different attribute sets.
 */
function cookieOptions(env: SessionCookieEnv): Omit<CookieSerializeOptions, 'maxAge'> {
  return {
    httpOnly: true,
    // Plain HTTP localhost in dev can't set a `secure` cookie -- the browser
    // silently drops it.
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

export function sessionCookieOptions(env: SessionCookieEnv): CookieSerializeOptions {
  return { ...cookieOptions(env), maxAge: env.SESSION_TTL_DAYS * SECONDS_PER_DAY };
}

export function clearedSessionCookieOptions(env: SessionCookieEnv): CookieSerializeOptions {
  return { ...cookieOptions(env), maxAge: 0 };
}
