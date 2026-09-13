import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { applyAuthCookies } from './session-cookies';

jest.mock('./session-cookies', () => ({
  applyAuthCookies: jest.fn(() => 'csrf-token-value-123456'),
  applyAccessCookie: jest.fn(),
  clearAuthCookies: jest.fn(),
}));

describe('AuthController cookie session', () => {
  const tokens = {
    accessToken: 'access.jwt',
    refreshToken: 'refresh.jwt',
    expiresIn: '15m',
    tokenType: 'Bearer',
  };

  function make() {
    const authService = {
      login: jest.fn().mockResolvedValue(tokens),
      refresh: jest.fn().mockResolvedValue(tokens),
    } as unknown as AuthService;
    const config = { get: jest.fn() } as unknown as ConfigService;
    const controller = new AuthController(authService, config);
    const res = { cookie: jest.fn() } as unknown as import('express').Response;
    const req = { ip: '127.0.0.1', headers: { 'user-agent': 'jest', cookie: '' } } as import('express').Request;
    return { controller, authService, res, req };
  }

  it('omits JWTs from body when cookieSession is true', async () => {
    const { controller, res, req } = make();
    const result = await controller.login(
      { identifier: 'admin@city.local', password: 'Admin@1234', cookieSession: true },
      req,
      res,
    );
    expect(applyAuthCookies).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      data: { expiresIn: '15m', tokenType: 'Bearer', session: 'cookie' },
    });
    expect(JSON.stringify(result)).not.toContain('access.jwt');
  });

  it('returns JWTs in body for API/M2M login', async () => {
    const { controller, res, req } = make();
    const result = await controller.login(
      { identifier: 'admin@city.local', password: 'Admin@1234' },
      req,
      res,
    );
    expect(result).toEqual({ success: true, data: tokens });
  });
});
