import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';

function ctx(overrides: { public?: boolean; method?: string; auth?: string; cookie?: string; csrfHeader?: string }) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(Boolean(overrides.public)),
  } as unknown as Reflector;
  const guard = new CsrfGuard(reflector);
  const request = {
    method: overrides.method ?? 'POST',
    headers: {
      authorization: overrides.auth,
      cookie: overrides.cookie,
      'x-csrf-token': overrides.csrfHeader,
    },
  };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard, context, reflector };
}

describe('CsrfGuard', () => {
  it('skips public and safe methods', () => {
    expect(ctx({ public: true }).guard.canActivate(ctx({ public: true }).context)).toBe(true);
    const get = ctx({ method: 'GET' });
    expect(get.guard.canActivate(get.context)).toBe(true);
  });

  it('rejects mutating requests with neither bearer nor csrf', () => {
    const { guard, context } = ctx({ method: 'POST' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('skips bearer API clients', () => {
    const { guard, context } = ctx({ auth: 'Bearer aaa.bbb.ccc', method: 'PATCH' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects cookie session mutating requests without matching csrf', () => {
    const { guard, context } = ctx({
      cookie: 'cm_csrf=abcdefghijklmnopqr',
      csrfHeader: 'different-token-value1',
      method: 'POST',
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('accepts matching double-submit csrf', () => {
    const token = 'abcdefghijklmnopqr';
    const { guard, context } = ctx({
      cookie: `cm_csrf=${token}`,
      csrfHeader: token,
      method: 'DELETE',
    });
    expect(guard.canActivate(context)).toBe(true);
  });
});
