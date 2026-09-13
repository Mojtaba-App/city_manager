import type { ApiResponse } from '@city-manager/shared';

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => string | null | undefined;
  fetch?: typeof fetch;
};

export type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/**
 * Thin typed OpenAPI-oriented client for City Manager API.
 * Pair with openapi.json / openapi-typescript generated schema.
 */
export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? fetch;

  async function request<T = unknown>(
    path: string,
    req: ApiRequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(req.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...req.headers,
    };
    const token = req.token ?? options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${options.baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await doFetch(url, {
      method: req.method ?? (req.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      signal: req.signal,
    });

    const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
    if (json && typeof json === 'object' && 'success' in json) return json;
    return {
      success: false,
      error: {
        code: `HTTP_${res.status}`,
        message: res.statusText || 'درخواست ناموفق بود',
      },
    };
  }

  return {
    request,
    health: () => request<{ status?: string }>('/health'),
    login: (email: string, password: string) =>
      request('/auth/login', { method: 'POST', body: { email, password } }),
    me: (token?: string) => request('/auth/me', { token }),
    listHouseholds: (token?: string) => request('/case/households', { token }),
    listNeighborhoods: (token?: string) => request('/gis/neighborhoods', { token }),
  };
}

export type CityManagerApiClient = ReturnType<typeof createApiClient>;
