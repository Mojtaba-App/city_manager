import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@city-manager/shared';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_MODE_KEY,
  IS_PUBLIC_KEY,
} from '../decorators/auth.decorators';
import { JwtPayload } from '@city-manager/shared';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const mode =
      this.reflector.getAllAndOverride<'all' | 'any'>(PERMISSIONS_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'all';

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }

    const hasPermission =
      mode === 'any'
        ? requiredPermissions.some((p) => user.permissions.includes(p))
        : requiredPermissions.every((p) => user.permissions.includes(p));

    if (!hasPermission) {
      throw new ForbiddenException('مجوز کافی برای این عملیات وجود ندارد');
    }

    return true;
  }
}
