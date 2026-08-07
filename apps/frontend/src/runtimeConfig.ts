import { appConfig } from '@rondo/config';

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

/**
 * Resolves and normalizes the configured API base URL. Exported as a pure
 * function (separate from the `apiBaseUrl` constant below) so it can be
 * unit-tested without depending on Vite's static `import.meta.env`
 * substitution. Strips trailing slashes so callers can always safely do
 * `${apiBaseUrl}/health` without risking a double slash.
 */
export function resolveApiBaseUrl(rawValue: string | undefined, fallback: string): string {
  const value = rawValue && rawValue.trim().length > 0 ? rawValue : fallback;
  return trimTrailingSlashes(value);
}

/**
 * Single source of truth for the API base URL — every other module (the
 * authenticated API client, the initial health check) reads it from here
 * instead of recomputing `import.meta.env.VITE_API_BASE_URL ?? appConfig.apiBaseUrl`
 * itself. Empty by default (the fallback, `appConfig.apiBaseUrl`, is also
 * ''): API calls are relative paths, resolved same-origin through a proxy
 * (Vite's dev server in local dev, a Vercel rewrite in beta/production) --
 * required for the httpOnly session cookie to be sent at all.
 */
export const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, appConfig.apiBaseUrl);

/**
 * Closed-beta sign-up gate. Defaults to hidden (safe) when unset — must be
 * explicitly "true" to show "Crear cuenta". This is a UX convenience only:
 * the backend itself doesn't restrict who can register (see
 * docs/AUTHENTICATION.md) -- during the closed beta, this flag just hides
 * the self-registration entry point from the UI.
 */
export const isSignUpEnabled = import.meta.env.VITE_BETA_SIGN_UP_ENABLED === 'true';

/**
 * Public half of the Web Push VAPID key pair -- safe to ship to the client
 * (see docs/WEB_PUSH.md). Empty string when unset so callers can feature-gate
 * on it (`Boolean(vapidPublicKey)`) instead of crashing at import time; the
 * push activation UI is the only thing that reads this.
 */
export const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
