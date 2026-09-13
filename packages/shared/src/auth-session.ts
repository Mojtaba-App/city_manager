export const AUTH_COOKIE_ACCESS = 'cm_access';
export const AUTH_COOKIE_REFRESH = 'cm_refresh';
export const AUTH_COOKIE_CSRF = 'cm_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function parseCookieHeader(header?: string | string[]): Record<string, string> {
  const raw = Array.isArray(header) ? header.join('; ') : header;
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function csrfTokensMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b || a.length !== b.length || a.length < 16) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function expiryToMaxAgeSeconds(expiry: string, fallbackSeconds: number): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackSeconds;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? fallbackSeconds);
}

export function usesBearerAuthorization(header?: string | string[]): boolean {
  const raw = Array.isArray(header) ? header[0] : header;
  return Boolean(raw && /^Bearer\s+\S+/i.test(raw.trim()));
}
