import { useAuth } from '@clerk/react';
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

export function useApi() {
  const { getToken } = useAuth();

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        // Only set Content-Type when there is an actual body: Fastify's
        // default JSON parser rejects an empty body outright when the
        // content-type claims 'application/json' (FST_ERR_CTP_EMPTY_JSON_BODY),
        // which broke every no-payload POST (accept/reject/cancel invitation,
        // leave match).
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, payload?: unknown) =>
      request<T>(path, { method: 'POST', body: payload !== undefined ? JSON.stringify(payload) : undefined }),
    put: <T>(path: string, payload?: unknown) =>
      request<T>(path, { method: 'PUT', body: payload !== undefined ? JSON.stringify(payload) : undefined }),
    patch: <T>(path: string, payload?: unknown) =>
      request<T>(path, { method: 'PATCH', body: payload !== undefined ? JSON.stringify(payload) : undefined }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}
