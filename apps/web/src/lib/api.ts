import {
  AUTH_COOKIE_CSRF,
  CSRF_HEADER_NAME,
  parseApiResult,
  parseCookieHeader,
} from '@city-manager/shared';

function browserApiBase(): string {
  if (typeof window !== 'undefined') return '/api/v1';
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
}

export const API_URL = browserApiBase();

export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
  expiresIn: string;
  tokenType: string;
  session?: 'cookie' | 'bearer';
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  organizationId?: string;
  roles: string[];
  permissions: string[];
}

export interface LoginOtpChallenge {
  requiresOtp: true;
  challengeId: string;
  maskedPhone: string;
  expiresInSec: number;
  resendAfterSec: number;
  devCode?: string;
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  meta?: { page?: number; limit?: number; total?: number };
  error?: { code: string; message: string; retryAfterSec?: number; contactAdmin?: boolean };
}

export function readCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return parseCookieHeader(document.cookie)[AUTH_COOKIE_CSRF];
}

export function sessionHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const csrf = readCsrfToken();
  if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  return headers;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshCookieSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const res = await fetch(`${browserApiBase()}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: sessionHeaders(),
      body: JSON.stringify({}),
    });
    return res.ok;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<ApiResult<T>> {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...sessionHeaders(!isForm && !(options.headers as Record<string, string> | undefined)?.['Content-Type']),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (isForm) {
    delete headers['Content-Type'];
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const exec = () => fetch(`${browserApiBase()}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  let res: Response;
  try {
    res = await exec();
  } catch {
    return {
      success: false,
      error: {
        code: 'NETWORK',
        message: 'ارتباط با سرور برقرار نشد. چند ثانیه صبر کنید و دوباره وارد شوید.',
      },
    };
  }
  // Only try cookie refresh when a CSRF cookie hints a prior session (refresh is HttpOnly).
  if (res.status === 401 && !path.startsWith('/auth/') && !token && readCsrfToken()) {
    const ok = await refreshCookieSession();
    if (ok) res = await exec();
  }

  let json: unknown = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return parseApiResult<T>(json, res.ok);
}

export async function login(identifier: string, password: string) {
  return apiFetch<AuthTokens | LoginOtpChallenge>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, cookieSession: true }),
  });
}

export async function verifyLoginOtp(challengeId: string, code: string) {
  return apiFetch<AuthTokens>('/auth/login/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ challengeId, code, cookieSession: true }),
  });
}

export async function resendLoginOtp(challengeId: string) {
  return apiFetch<LoginOtpChallenge>('/auth/login/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ challengeId }),
  });
}

export async function logoutSession() {
  return apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
}

export async function getProfile(token?: string) {
  return apiFetch<UserProfile>('/auth/me', {}, token);
}

export async function updateProfile(
  payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    jobTitle?: string;
    department?: string;
    bio?: string;
    avatarUrl?: string | null;
  },
  token?: string,
) {
  return apiFetch<UserProfile>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch('/auth/me/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function forgotPassword(phone: string) {
  return apiFetch<{ message: string; devPassword?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function checkHealth() {
  return apiFetch<{ status: string; timestamp: string }>('/health');
}

export { browserApiBase };
