import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

export interface AuditMeta {
  action: string;
  resource: string;
  /** path to resource id on request, e.g. 'params.id' */
  resourceIdParam?: string;
  severity?: 'info' | 'warning' | 'critical';
}

/** Mark a handler for automatic audit logging via AuditInterceptor */
export const Audited = (meta: AuditMeta) => SetMetadata(AUDIT_ACTION_KEY, meta);
