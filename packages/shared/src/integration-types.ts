export enum ConnectorType {
  REST_API = 'rest_api',
  WEBHOOK = 'webhook',
  CSV_FILE = 'csv_file',
  OTHER = 'other',
}

export enum SyncDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  BIDIRECTIONAL = 'bidirectional',
}

export enum SyncJobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum AuthType {
  NONE = 'none',
  API_KEY = 'api_key',
  BEARER = 'bearer',
  BASIC = 'basic',
  CUSTOM_HEADER = 'custom_header',
}

export enum QueueItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  DEAD = 'dead',
}

export enum IntegrationTargetEntity {
  HOUSEHOLD = 'household',
  MEMBER = 'member',
  DWELLING = 'dwelling',
  AGENCY = 'agency',
  CUSTOM = 'custom',
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs?: number;
}

export interface ConnectionProfileAuth {
  type: AuthType;
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  /** Never returned in API responses when encrypted */
  password?: string;
  headerName?: string;
  headerValue?: string;
}

export interface ConnectionEndpoints {
  health?: string;
  list?: string;
  getById?: string;
  webhookPath?: string;
}

export interface ConnectionProfile {
  baseUrl?: string;
  auth: ConnectionProfileAuth;
  endpoints: ConnectionEndpoints;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retry: RetryPolicy;
  webhookSecret?: string;
  scheduleCron?: string;
  scheduleIntervalMinutes?: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: 2000,
  backoffMultiplier: 2,
  maxBackoffMs: 60000,
};

export const CONNECTOR_TYPE_LABELS: Record<ConnectorType, string> = {
  [ConnectorType.REST_API]: 'REST API',
  [ConnectorType.WEBHOOK]: 'Webhook',
  [ConnectorType.CSV_FILE]: 'فایل CSV',
  [ConnectorType.OTHER]: 'سایر',
};

export const SYNC_DIRECTION_LABELS: Record<SyncDirection, string> = {
  [SyncDirection.INBOUND]: 'ورودی (Inbound)',
  [SyncDirection.OUTBOUND]: 'خروجی (Outbound)',
  [SyncDirection.BIDIRECTIONAL]: 'دوطرفه',
};

export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  [AuthType.NONE]: 'بدون احراز هویت',
  [AuthType.API_KEY]: 'API Key',
  [AuthType.BEARER]: 'Bearer Token',
  [AuthType.BASIC]: 'Basic',
  [AuthType.CUSTOM_HEADER]: 'هدر سفارشی',
};

export const TARGET_ENTITY_LABELS: Record<IntegrationTargetEntity, string> = {
  [IntegrationTargetEntity.HOUSEHOLD]: 'خانوار',
  [IntegrationTargetEntity.MEMBER]: 'عضو خانوار',
  [IntegrationTargetEntity.DWELLING]: 'ملک / سکونتگاه',
  [IntegrationTargetEntity.AGENCY]: 'دستگاه / سازمان',
  [IntegrationTargetEntity.CUSTOM]: 'سفارشی',
};

export const QUEUE_STATUS_LABELS: Record<QueueItemStatus, string> = {
  [QueueItemStatus.PENDING]: 'در انتظار',
  [QueueItemStatus.PROCESSING]: 'در حال پردازش',
  [QueueItemStatus.SUCCEEDED]: 'موفق',
  [QueueItemStatus.FAILED]: 'ناموفق',
  [QueueItemStatus.DEAD]: 'متوقف (Dead)',
};

export const SYNC_STATUS_LABELS: Record<SyncJobStatus, string> = {
  [SyncJobStatus.PENDING]: 'در انتظار',
  [SyncJobStatus.QUEUED]: 'در صف',
  [SyncJobStatus.RUNNING]: 'در حال اجرا',
  [SyncJobStatus.SUCCESS]: 'موفق',
  [SyncJobStatus.PARTIAL]: 'ناقص',
  [SyncJobStatus.FAILED]: 'ناموفق',
  [SyncJobStatus.CANCELLED]: 'لغو شده',
};

/** Public inbound webhook URL for a connector (org-scoped, LTR path). */
export function buildPublicWebhookUrl(
  apiBaseUrl: string,
  organizationIdOrCode: string,
  code?: string,
): string {
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  // Backward-compatible: buildPublicWebhookUrl(base, code) still works but is ambiguous across orgs.
  if (code === undefined) {
    const safeCode = encodeURIComponent(String(organizationIdOrCode || '').trim());
    return `${base}/integrations/webhooks/${safeCode}`;
  }
  const orgId = encodeURIComponent(String(organizationIdOrCode || '').trim());
  const safeCode = encodeURIComponent(String(code || '').trim());
  return `${base}/integrations/webhooks/${orgId}/${safeCode}`;
}

/**
 * Join API base (e.g. http://host/api/v1) with an endpoint path.
 * Accepts either `/integrations/...` or legacy `/api/v1/integrations/...`.
 */
export function resolveApiEndpointUrl(apiBaseUrl: string, path: string): string {
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  let p = String(path || '').trim();
  if (!p) return base;
  if (!p.startsWith('/')) p = `/${p}`;
  // Strip a leading /api/v1 (or /api/vN) when base already ends with it.
  if (/\/api\/v\d+$/i.test(base)) {
    p = p.replace(/^\/api\/v\d+(?=\/|$)/i, '');
    if (!p.startsWith('/')) p = `/${p}`;
  }
  return `${base}${p}`;
}

