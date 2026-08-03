import { appConfig } from '@rondo/config';

/**
 * Single source of truth for the API base URL — every other module (the
 * authenticated API client, the initial health check) reads it from here
 * instead of recomputing `import.meta.env.VITE_API_BASE_URL ?? appConfig.apiBaseUrl`
 * itself. The fallback is only ever exercised in local dev: Vercel always
 * sets VITE_API_BASE_URL explicitly for the beta/production builds.
 */
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? appConfig.apiBaseUrl;

/**
 * Closed-beta sign-up gate. Defaults to hidden (safe) when unset — must be
 * explicitly "true" to show "Crear cuenta". This is a UX convenience only:
 * the real restriction has to be configured in the Clerk dashboard too (see
 * docs/BETA_DEPLOYMENT.md), since the frontend can never be trusted to
 * enforce who is allowed to register.
 */
export const isSignUpEnabled = import.meta.env.VITE_BETA_SIGN_UP_ENABLED === 'true';
