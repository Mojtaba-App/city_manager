import { apiFetch } from './api';
import {
  AbacDecision,
  AuditLogDto,
  DataAccessLogDto,
  ExportLogDto,
  OauthClientDto,
  PiiAccessPurpose,
  SecretMetaDto,
  SecurityOverviewDto,
} from '@city-manager/shared';

export async function fetchSecurityOverview() {
  return apiFetch<SecurityOverviewDto>('/security/overview', {});
}

export async function fetchSecurityAudit(params?: {
  page?: number;
  limit?: number;
  action?: string;
  resource?: string;
  userId?: string;
  outcome?: string;
  from?: string;
  to?: string;
  q?: string;
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.action) search.set('action', params.action);
  if (params?.resource) search.set('resource', params.resource);
  if (params?.userId) search.set('userId', params.userId);
  if (params?.outcome) search.set('outcome', params.outcome);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.q) search.set('q', params.q);
  const q = search.toString() ? `?${search}` : '';
  return apiFetch<{ items: AuditLogDto[]; total: number; page: number; limit: number }>(
    `/security/audit${q}`,
    {}
  );
}

export async function fetchAbacPolicies() {
  return apiFetch<Array<Record<string, unknown>>>('/security/policies', {});
}

export async function createAbacPolicy(payload: {
  name: string;
  description?: string;
  effect: 'allow' | 'deny';
  priority?: number;
  resourceType: string;
  actions: string[];
  condition?: Record<string, unknown>;
  isActive?: boolean;
}) {
  return apiFetch('/security/policies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAbacPolicy(id: string, payload: Record<string, unknown>) {
  return apiFetch(`/security/policies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAbacPolicy(id: string) {
  return apiFetch(`/security/policies/${id}`, { method: 'DELETE' });
}

export async function evaluateAbac(payload: {
  resource: { type: string; id?: string; organizationId?: string; neighborhoodId?: string };
  action: string;
}) {
  return apiFetch<AbacDecision>('/security/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchSecrets() {
  return apiFetch<SecretMetaDto[]>('/security/secrets', {});
}

export async function upsertSecret(payload: { key: string; value: string; description?: string }) {
  return apiFetch('/security/secrets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteSecret(key: string) {
  return apiFetch(`/security/secrets/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

export async function fetchOauthClients() {
  return apiFetch<OauthClientDto[]>('/security/oauth/clients', {});
}

export async function createOauthClient(payload: { name: string; scopes?: string[] }) {
  return apiFetch<OauthClientDto>('/security/oauth/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function revokeOauthClient(id: string) {
  return apiFetch(`/security/oauth/clients/${id}/revoke`, { method: 'POST' });
}

export async function previewMasking(record: Record<string, unknown>) {
  return apiFetch('/security/masking/preview', {
    method: 'POST',
    body: JSON.stringify({ record }),
  });
}

export async function fetchPiiAccessLogs(limit = 50) {
  return apiFetch<DataAccessLogDto[]>(`/security/pii/access-logs?limit=${limit}`, {});
}

export async function fetchExportLogs(limit = 50) {
  return apiFetch<ExportLogDto[]>(`/security/pii/export-logs?limit=${limit}`, {});
}

export async function createPiiGrant(payload: {
  resourceType: string;
  resourceId?: string;
  fields?: string[];
  purpose: PiiAccessPurpose | string;
  reason: string;
  expiresInHours?: number;
}) {
  return apiFetch('/security/pii/grants', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type { AuditLogDto, DataAccessLogDto, ExportLogDto, SecurityOverviewDto, SecretMetaDto, OauthClientDto };
