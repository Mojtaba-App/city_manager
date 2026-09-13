import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  AUTH_COOKIE_CSRF,
  CSRF_HEADER_NAME,
  csrfTokensMatch,
  parseCookieHeader,
  usesBearerAuthorization,
} from '@city-manager/shared';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const method = (req.method || 'GET').toUpperCase();
    if (SAFE_METHODS.has(method)) return true;
    if (usesBearerAuthorization(req.headers.authorization)) return true;

    const cookies = parseCookieHeader(req.headers.cookie);
    const cookieToken = cookies[AUTH_COOKIE_CSRF];
    const headerToken = String(req.headers[CSRF_HEADER_NAME] ?? '');
    if (!csrfTokensMatch(cookieToken, headerToken)) {
      throw new ForbiddenException('توکن CSRF نامعتبر است');
    }
    return true;
  }
}
