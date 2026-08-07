import { apiBaseUrl } from './runtimeConfig';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };

async function parseErrorBody(response: Response): Promise<ErrorBody> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return {};
  }
}

/**
 * Session-cookie auth (see AuthProvider.tsx): no token to attach, just
 * `credentials: 'include'` so the httpOnly rondo_session cookie travels
 * with every request. `apiBaseUrl` is '' in normal operation (relative
 * paths, same-origin via the Vercel/Vite proxy -- see vite.config.ts and
 * vercel.json); it's only ever non-empty as a dev override for pointing at
 * a backend on a different port than the proxy expects.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      // Only set Content-Type when there is an actual body: Fastify's
      // default JSON parser rejects an empty body outright when the
      // content-type claims 'application/json' (FST_ERR_CTP_EMPTY_JSON_BODY),
      // which broke every no-payload POST (accept/reject/cancel invitation,
      // leave match).
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw new ApiError(body.error?.message ?? `Error ${response.status}`, response.status, body.error?.code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, payload?: unknown) => request<T>(path, { method: 'POST', body: payload !== undefined ? JSON.stringify(payload) : undefined }),
  put: <T>(path: string, payload?: unknown) => request<T>(path, { method: 'PUT', body: payload !== undefined ? JSON.stringify(payload) : undefined }),
  patch: <T>(path: string, payload?: unknown) => request<T>(path, { method: 'PATCH', body: payload !== undefined ? JSON.stringify(payload) : undefined }),
  delete: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'DELETE', body: payload !== undefined ? JSON.stringify(payload) : undefined }),
};

/** No longer needs to be a hook (no auth-token lookup left to do), but kept as one so every existing call site (`const api = useApi();`) keeps working unchanged. */
export function useApi() {
  return api;
}
