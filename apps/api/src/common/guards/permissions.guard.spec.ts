import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission, SystemRole } from '@city-manager/shared';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, PERMISSIONS_MODE_KEY } from '../decorators/auth.decorators';

function ctx(user?: unknown) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('allows public routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('allows when no permissions required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(ctx({ permissions: [] }))).toBe(true);
  });

  it('denies missing user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return [Permission.USERS_READ];
      return undefined;
    });
    expect(() => guard.canActivate(ctx())).toThrow(ForbiddenException);
  });

  it('requires all listed permissions (AND)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return [Permission.USERS_READ, Permission.USERS_WRITE];
      return undefined;
    });
    expect(() =>
      guard.canActivate(
        ctx({
          permissions: [Permission.USERS_READ],
          roles: [SystemRole.VIEWER],
        }),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        ctx({
          permissions: [Permission.USERS_READ, Permission.USERS_WRITE],
          roles: [SystemRole.ORG_ADMIN],
        }),
      ),
    ).toBe(true);
  });

  it('allows when any listed permission matches (OR)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) {
        return [Permission.SHARE_VIEWS_MANAGE, Permission.REPORTS_WRITE];
      }
      if (key === PERMISSIONS_MODE_KEY) return 'any';
      return undefined;
    });
    expect(
      guard.canActivate(
        ctx({
          permissions: [Permission.REPORTS_WRITE],
          roles: [SystemRole.MANAGER],
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        ctx({
          permissions: [Permission.REPORTS_READ],
          roles: [SystemRole.VIEWER],
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
