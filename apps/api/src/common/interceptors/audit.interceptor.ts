import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuditOutcome, AuditSeverity, JwtPayload } from '@city-manager/shared';
import { AUDIT_ACTION_KEY, AuditMeta } from '../decorators/audit.decorator';
import { AuditService } from '../../modules/audit/audit.service';
import { FieldMaskingService } from '../../modules/security/services/field-masking.service';
import * as crypto from 'crypto';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    private readonly masking: FieldMaskingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const user = req.user as JwtPayload | undefined;
    const requestId =
      (req.headers['x-request-id'] as string) ||
      crypto.randomBytes(8).toString('hex');
    req.requestId = requestId;

    const resourceId = meta.resourceIdParam
      ? this.resolvePath(req, meta.resourceIdParam)
      : req.params?.id;

    const base = {
      userId: user?.sub,
      organizationId: user?.orgId ?? undefined,
      action: meta.action,
      resource: meta.resource,
      resourceId: resourceId ? String(resourceId) : undefined,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      requestId,
      severity: (meta.severity as AuditSeverity) || AuditSeverity.INFO,
      payload: this.masking.sanitizePayload({
        method: req.method,
        path: req.route?.path || req.url,
        query: req.query,
      }),
    };

    return next.handle().pipe(
      tap(() => {
        void this.audit.log({ ...base, outcome: AuditOutcome.SUCCESS });
      }),
      catchError((err) => {
        const denied = err?.status === 403;
        void this.audit.log({
          ...base,
          outcome: denied ? AuditOutcome.DENIED : AuditOutcome.FAILURE,
          severity: denied ? AuditSeverity.WARNING : AuditSeverity.CRITICAL,
          payload: this.masking.sanitizePayload({
            ...base.payload,
            error: err?.message,
          }),
        });
        return throwError(() => err);
      }),
    );
  }

  private resolvePath(obj: unknown, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
      return undefined;
    }, obj);
  }
}
