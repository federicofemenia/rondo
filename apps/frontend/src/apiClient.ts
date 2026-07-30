import { useAuth } from '@clerk/react';
import { appConfig } from '@rondo/config';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? appConfig.apiBaseUrl;

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
        'Content-Type': 'application/json',
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
  };
}
