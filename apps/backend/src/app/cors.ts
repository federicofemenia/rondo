const LOCAL_DEV_ORIGIN = 'http://localhost:5173';

// A browser's Origin header never has a trailing slash, so a FRONTEND_URL
// pasted with one (e.g. "https://rondo-beta.vercel.app/") would otherwise
// never match and silently break CORS. Only applied to the configured
// value below — LOCAL_DEV_ORIGIN is already a known-good literal.
const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

// Vite falls back to 5174, 5175, etc. whenever its default port is already
// taken (a second dev server, a stale process from a previous run...), so
// pinning dev/test CORS to exactly :5173 breaks local development the
// moment that happens. Matched only when allowAnyLocalPort is true (never
// in production — see createCorsOriginValidator below).
const ANY_LOCAL_PORT_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Local dev origin, plus the configured beta/production frontend origin, if any. */
export function buildAllowedOrigins(frontendUrl: string | undefined): string[] {
  const origins = new Set<string>([LOCAL_DEV_ORIGIN]);
  if (frontendUrl) {
    origins.add(trimTrailingSlashes(frontendUrl));
  }
  return [...origins];
}

type CorsOriginCallback = (error: Error | null, allow: boolean) => void;

type CorsOriginValidatorOptions = {
  /** Dev/test only: accept any localhost/127.0.0.1 origin regardless of port. Never set in production. */
  allowAnyLocalPort?: boolean;
};

/**
 * @fastify/cors origin validator backed by an explicit allowlist — never
 * `origin: true`/`*`. Requests without an Origin header (server-to-server,
 * curl, the health check) are always allowed since there is no browser
 * same-origin policy to enforce for them.
 */
export function createCorsOriginValidator(allowedOrigins: string[], options: CorsOriginValidatorOptions = {}) {
  return (origin: string | undefined, callback: CorsOriginCallback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    if (options.allowAnyLocalPort && ANY_LOCAL_PORT_PATTERN.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed: ${origin}`), false);
  };
}
