import {
  ConnectorType, SyncDirection, AuthType, IntegrationTargetEntity,
  CONNECTOR_TYPE_LABELS, SYNC_STATUS_LABELS, SYNC_DIRECTION_LABELS,
  AUTH_TYPE_LABELS, TARGET_ENTITY_LABELS, QUEUE_STATUS_LABELS,
  buildPublicWebhookUrl,
} from '@city-manager/shared';
import { apiFetch, API_URL } from './api';

export type ConnectorRow = {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  description?: string;
  connectorType: string;
  syncDirection: string;
  targetEntity: string;
  isActive: boolean;
  scheduleIntervalMinutes?: number;
  nextRunAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
  webhookUrlHint?: string;
  profile?: {
    baseUrl?: string;
    csvUrl?: string;
    endpoints?: { health?: string; list?: string };
    auth?: { type: string };
    timeoutMs?: number;
    retry?: { maxAttempts: number; backoffMs: number };
  };
  mappings?: Array<{
    id?: string;
    sourceField: string;
    targetField: string;
    isRequired?: boolean;
    transformRule?: Record<string, unknown>;
  }>;
};

export async function fetchConnectors() {
  return apiFetch<ConnectorRow[]>('/integrations/connectors', {});
}

export async function fetchConnector(id: string) {
  return apiFetch<ConnectorRow>(`/integrations/connectors/${id}`, {});
}

export async function createConnector(payload: Record<string, unknown>) {
  return apiFetch('/integrations/connectors', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateConnector(id: string, payload: Record<string, unknown>) {
  return apiFetch(`/integrations/connectors/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteConnector(id: string) {
  return apiFetch(`/integrations/connectors/${id}`, { method: 'DELETE' });
}

export async function saveMappings(id: string, mappings: Array<Record<string, unknown>>) {
  return apiFetch(`/integrations/connectors/${id}/mappings`, {
    method: 'PUT',
    body: JSON.stringify({ mappings }),
  });
}

export async function testConnector(id: string) {
  return apiFetch<{
    ok: boolean;
    statusCode?: number;
    latencyMs?: number;
    message?: string;
    responsePreview?: string;
  }>(`/integrations/connectors/${id}/test`, { method: 'POST' });
}

export async function syncConnector(id: string) {
  return apiFetch(`/integrations/connectors/${id}/sync`, { method: 'POST' });
}

export async function queueSyncConnector(id: string) {
  return apiFetch(`/integrations/connectors/${id}/sync/queue`, { method: 'POST' });
}

export async function fetchSyncJobs(connectorId?: string) {
  const q = connectorId ? `?connectorId=${connectorId}` : '';
  return apiFetch(`/integrations/jobs${q}`, {});
}

export async function fetchSyncJob(id: string) {
  return apiFetch(`/integrations/jobs/${id}`, {});
}

export async function fetchQueue() {
  return apiFetch('/integrations/queue', {});
}

export async function fetchDlq(limit = 50) {
  return apiFetch(`/integrations/dlq?limit=${limit}`, {});
}

export async function requeueDlq(id: string) {
  return apiFetch(`/integrations/dlq/${id}/requeue`, { method: 'POST', body: '{}' });
}

export async function processQueue() {
  return apiFetch('/integrations/queue/process', { method: 'POST' });
}

export async function fetchWebhookEvents(connectorId?: string) {
  const q = connectorId ? `?connectorId=${connectorId}` : '';
  return apiFetch(`/integrations/webhooks/events${q}`, {});
}

export async function fetchIntegrationDocs() {
  return apiFetch<{
    endpoints: Array<{ method: string; path: string; desc: string }>;
    authNotes: string[];
  }>('/integrations/docs', {});
}

export function publicWebhookUrl(code: string, organizationId?: string) {
  if (organizationId) return buildPublicWebhookUrl(API_URL, organizationId, code);
  return buildPublicWebhookUrl(API_URL, code);
}

/** Join API base with endpoint path (avoids duplicated /api/v1). Local copy so UI never depends on stale shared dist. */
export function resolveApiEndpointUrl(apiBaseUrl: string, path: string): string {
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  let p = String(path || '').trim();
  if (!p) return base;
  if (!p.startsWith('/')) p = `/${p}`;
  if (/\/api\/v\d+$/i.test(base)) {
    p = p.replace(/^\/api\/v\d+(?=\/|$)/i, '');
    if (!p.startsWith('/')) p = `/${p}`;
  }
  return `${base}${p}`;
}

export function docsEndpointUrl(path: string) {
  return resolveApiEndpointUrl(API_URL, path);
}

export {
  ConnectorType, SyncDirection, AuthType, IntegrationTargetEntity,
  CONNECTOR_TYPE_LABELS, SYNC_STATUS_LABELS, SYNC_DIRECTION_LABELS,
  AUTH_TYPE_LABELS, TARGET_ENTITY_LABELS, QUEUE_STATUS_LABELS, API_URL,
  buildPublicWebhookUrl,
};
