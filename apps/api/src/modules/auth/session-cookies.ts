import { CookieOptions, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  AUTH_COOKIE_ACCESS,
  AUTH_COOKIE_CSRF,
  AUTH_COOKIE_REFRESH,
  expiryToMaxAgeSeconds,
} from '@city-manager/shared';

function baseCookie(config: ConfigService, maxAgeSec: number, httpOnly: boolean): CookieOptions {
  const secure = config.get<string>('COOKIE_SECURE', process.env.NODE_ENV === 'production' ? 'true' : 'false') === 'true';
  return {
    httpOnly,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec * 1000,
  };
}

export function createCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function applyAuthCookies(
  res: Response,
  config: ConfigService,
  tokens: { accessToken: string; refreshToken: string },
): string {
  const accessMax = expiryToMaxAgeSeconds(config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'), 900);
  const refreshMax = expiryToMaxAgeSeconds(config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'), 604800);
  const csrf = createCsrfToken();
  res.cookie(AUTH_COOKIE_ACCESS, tokens.accessToken, baseCookie(config, accessMax, true));
  res.cookie(AUTH_COOKIE_REFRESH, tokens.refreshToken, baseCookie(config, refreshMax, true));
  res.cookie(AUTH_COOKIE_CSRF, csrf, baseCookie(config, refreshMax, false));
  return csrf;
}

/** Refresh only the access cookie (e.g. after permission catalog updates). */
export function applyAccessCookie(
  res: Response,
  config: ConfigService,
  accessToken: string,
): void {
  const accessMax = expiryToMaxAgeSeconds(config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'), 900);
  res.cookie(AUTH_COOKIE_ACCESS, accessToken, baseCookie(config, accessMax, true));
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const opts = baseCookie(config, 0, true);
  res.clearCookie(AUTH_COOKIE_ACCESS, opts);
  res.clearCookie(AUTH_COOKIE_REFRESH, opts);
  res.clearCookie(AUTH_COOKIE_CSRF, { ...opts, httpOnly: false });
}
