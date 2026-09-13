import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { applyAuthCookies, clearAuthCookies } from './session-cookies';

describe('session cookies', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      if (key === 'COOKIE_SECURE') return 'false';
      return fallback;
    }),
  } as unknown as ConfigService;

  it('sets httpOnly access/refresh and readable csrf cookies', () => {
    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;
    const csrf = applyAuthCookies(res, config, { accessToken: 'acc', refreshToken: 'ref' });
    expect(csrf.length).toBeGreaterThanOrEqual(32);
    expect(cookie).toHaveBeenCalledWith('cm_access', 'acc', expect.objectContaining({ httpOnly: true, sameSite: 'lax' }));
    expect(cookie).toHaveBeenCalledWith('cm_refresh', 'ref', expect.objectContaining({ httpOnly: true }));
    expect(cookie).toHaveBeenCalledWith('cm_csrf', csrf, expect.objectContaining({ httpOnly: false }));
  });

  it('clears auth cookies on logout', () => {
    const clearCookie = jest.fn();
    const res = { clearCookie } as unknown as Response;
    clearAuthCookies(res, config);
    expect(clearCookie).toHaveBeenCalledWith('cm_access', expect.any(Object));
    expect(clearCookie).toHaveBeenCalledWith('cm_refresh', expect.any(Object));
    expect(clearCookie).toHaveBeenCalledWith('cm_csrf', expect.any(Object));
  });
});
