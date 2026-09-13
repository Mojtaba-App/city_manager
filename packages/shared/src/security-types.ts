/** مدل‌ها و قراردادهای لایه امنیت / RBAC+ABAC / ممیزی */

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  DENIED = 'denied',
}

export interface AuditLogDto {
  id: string;
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  outcome: AuditOutcome;
  severity: AuditSeverity;
  requestId?: string;
  createdAt: string;
}

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  action?: string;
  resource?: string;
  userId?: string;
  outcome?: AuditOutcome;
  from?: string;
  to?: string;
  q?: string;
}

export type MaskMode = 'redact' | 'partial' | 'hash' | 'none';

export interface FieldProtectionRule {
  field: string;
  requiredPermission: string;
  mask: MaskMode;
  /** برای ABAC: نام attribute که باید true باشد */
  attribute?: string;
}

/** کاتالوگ پیش‌فرض حفاظت فیلدهای حساس */
export const DEFAULT_FIELD_RULES: FieldProtectionRule[] = [
  { field: 'nationalId', requiredPermission: 'members:read_pii', mask: 'partial' },
  { field: 'phone', requiredPermission: 'members:read_pii', mask: 'partial' },
  { field: 'email', requiredPermission: 'members:read_pii', mask: 'partial' },
  { field: 'policyNumber', requiredPermission: 'insurance:read', mask: 'partial' },
  { field: 'incomeAmount', requiredPermission: 'trajectory:read_pii', mask: 'redact' },
  { field: 'income', requiredPermission: 'trajectory:read_pii', mask: 'redact' },
  { field: 'iban', requiredPermission: 'households:read_pii', mask: 'partial' },
  { field: 'addressDetail', requiredPermission: 'households:read_pii', mask: 'partial' },
];

export interface AbacSubject {
  userId: string;
  orgId: string | null;
  roles: string[];
  permissions: string[];
  /** محدوده جغرافیایی اختیاری */
  neighborhoodIds?: string[];
  zoneIds?: string[];
  attributes?: Record<string, unknown>;
}

export interface AbacResource {
  type: string;
  id?: string;
  organizationId?: string | null;
  neighborhoodId?: string | null;
  zoneId?: string | null;
  ownerId?: string | null;
  attributes?: Record<string, unknown>;
}

export interface AbacContext {
  action: string;
  time?: string;
  ip?: string;
  purpose?: string;
}

export interface AbacDecision {
  allow: boolean;
  reason: string;
  matchedPolicyIds?: string[];
}

export interface AbacPolicyDto {
  id: string;
  organizationId?: string | null;
  name: string;
  description?: string;
  effect: 'allow' | 'deny';
  priority: number;
  resourceType: string;
  actions: string[];
  /** شرط JSON: { "orgMatch": true, "neighborhoodInScope": true, "hasPermission": "x" } */
  condition: Record<string, unknown>;
  isActive: boolean;
}

export interface OauthClientDto {
  id: string;
  organizationId: string;
  clientId: string;
  name: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
  /** فقط هنگام ایجاد برگردانده می‌شود */
  clientSecret?: string;
}

export interface SecretMetaDto {
  id: string;
  organizationId: string;
  key: string;
  description?: string;
  keyVersion: number;
  rotatedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** هرگز مقدار خام */
  hasValue: boolean;
}

export interface SecurityOverviewDto {
  rbac: {
    roleCount: number;
    permissionCount: number;
    usersWithRoles: number;
  };
  abac: {
    policyCount: number;
    activePolicies: number;
    geoScopedUsers: number;
  };
  audit: {
    last24h: number;
    deniedLast24h: number;
    criticalLast24h: number;
  };
  secrets: {
    managedCount: number;
  };
  oauth: {
    clientCount: number;
    activeClients: number;
  };
  rateLimit: {
    ttlSeconds: number;
    limit: number;
    authLimit: number;
  };
}
