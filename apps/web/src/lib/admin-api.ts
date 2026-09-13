import {
  AdminDashboardStats, ReportDefinition, ROLE_LABELS,
} from '@city-manager/shared';
import { apiFetch } from './api';

export async function fetchAdminDashboard() {
  return apiFetch<AdminDashboardStats>('/admin/dashboard', {});
}

export async function fetchAdminActivity(limit = 30) {
  return apiFetch<Array<{
    id: string;
    action: string;
    resource: string;
    resourceId?: string;
    createdAt: string;
    userId?: string;
  }>>(`/admin/activity?limit=${limit}`, {});
}

export async function fetchAdminUsers(page = 1, search = '', limit = 20) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) q.set('search', search);
  return apiFetch<Array<{
    id: string;
    email: string;
    username?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    isActive: boolean;
    roles: string[];
    roleIds?: string[];
    lastLoginAt?: string;
    createdAt: string;
  }>>(`/admin/users?${q}`, {});
}

export async function fetchAdminUser(id: string) {
  return apiFetch<{
    id: string;
    email: string;
    username?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
    bio?: string;
    isActive: boolean;
    roles: string[];
    roleIds?: string[];
    lastLoginAt?: string;
    createdAt?: string;
    updatedAt?: string;
    lastLoginIp?: string;
    lastLoginUserAgent?: string;
    inactiveReason?: string;
    inactiveAt?: string;
    inactiveBy?: string;
  }>(`/admin/users/${id}`, {});
}

export async function createAdminUser(payload: Record<string, unknown>) {
  return apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAdminUser(id: string, payload: Record<string, unknown>) {
  return apiFetch(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteAdminUser(id: string, inactiveReason: string) {
  return apiFetch(`/admin/users/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ inactiveReason }),
  });
}

export async function fetchRoles() {
  return apiFetch<Array<{
    id: string;
    code: string;
    name: string;
    description?: string;
    permissions: string[];
    isSystem: boolean;
    defaultPermissions: string[];
  }>>('/admin/roles', {});
}

export async function createRole(payload: {
  code: string;
  name: string;
  description?: string;
  permissions?: string[];
}) {
  return apiFetch('/admin/roles', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateRole(id: string, payload: Record<string, unknown>) {
  return apiFetch(`/admin/roles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function fetchSettings() {
  return apiFetch<Array<{
    id: string;
    key: string;
    value: Record<string, unknown>;
    description?: string;
  }>>('/admin/settings', {});
}

export async function fetchUiConfig() {
  return apiFetch<{
    sidebar_nav: { items?: Record<string, { label?: string; icon?: string }> };
    map_defaults: { center?: [number, number]; zoom?: number; basemap?: string };
    org_branding?: {
      logoUrl?: string;
      markText?: string;
      title?: string;
      subtitle?: string;
      loginTitle?: string;
      loginSubtitle?: string;
      loginHeroTagline?: string;
      loginIconUrl?: string;
      faviconUrl?: string;
      loginBackgroundUrl?: string;
    };
  }>('/admin/ui-config', {});
}

export async function fetchPublicBranding() {
  return apiFetch<{
    logoUrl?: string;
    markText?: string;
    title?: string;
    subtitle?: string;
    loginTitle?: string;
    loginSubtitle?: string;
    loginHeroTagline?: string;
    loginIconUrl?: string;
    faviconUrl?: string;
    loginBackgroundUrl?: string;
  }>('/admin/public-branding', {});
}

export async function upsertSetting(payload: { key: string; value: Record<string, unknown>; description?: string }) {
  return apiFetch('/admin/settings', { method: 'POST', body: JSON.stringify(payload) });
}

export async function testDatabaseConnection() {
  return apiFetch<{
    ok: boolean;
    latencyMs: number;
    driver?: string;
    database?: string;
    checkedAt: string;
    message: string;
  }>('/admin/settings/test-database', { method: 'POST' });
}

export async function testMessagingConnection(channel: 'sms' | 'email') {
  return apiFetch<{
    ok: boolean;
    channel: 'sms' | 'email';
    latencyMs?: number;
    checkedAt: string;
    message: string;
  }>('/admin/settings/test-messaging', { method: 'POST', body: JSON.stringify({ channel }) });
}

export async function fetchReports() {
  return apiFetch<ReportDefinition[]>('/admin/reports', {});
}

export async function fetchReportTemplates() {
  return apiFetch<ReportDefinition[]>('/admin/reports/templates', {});
}

export async function registerReportTemplate(code: string) {
  return apiFetch<ReportDefinition>('/admin/reports/registry', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function unregisterReportTemplate(code: string) {
  return apiFetch<{ removed: boolean }>(`/admin/reports/registry/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
}

export async function fetchHouseholdStatusReport() {
  return apiFetch<Array<{ status: string; count: number }>>('/admin/reports/household-status', {});
}

export { ROLE_LABELS };
