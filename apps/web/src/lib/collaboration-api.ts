import { API_URL, apiFetch } from './api';
import {
  ConsentPurpose,
  PortalHouseholdSummary,
  ReferralStatus,
} from '@city-manager/shared';

function portalToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('portalAccessToken') ?? undefined : undefined;
}

// --- Notifications ---
export async function fetchNotifications(unreadOnly = false) {
  const qs = unreadOnly ? '?unreadOnly=1' : '';
  return apiFetch<Array<Record<string, unknown>>>(`/notifications${qs}`, {});
}

export function notificationStreamUrl(): string {
  return '/api/v1/notifications/stream';
}

export async function fetchUnreadCount() {
  return apiFetch<{ count: number }>('/notifications/unread-count', {});
}

export async function markNotificationRead(id: string) {
  return apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead() {
  return apiFetch('/notifications/read-all', { method: 'POST' });
}

// --- Consents ---
export async function fetchConsents(householdId: string) {
  return apiFetch<Array<Record<string, unknown>>>(`/consents?householdId=${householdId}`, {});
}

export async function createConsent(payload: Record<string, unknown>) {
  return apiFetch('/consents', { method: 'POST', body: JSON.stringify(payload) });
}

export async function grantConsent(id: string, payload?: Record<string, unknown>) {
  return apiFetch(`/consents/${id}/grant`, { method: 'POST', body: JSON.stringify(payload ?? {}) });
}

// --- Referrals ---
export async function fetchReferrals(params?: {
  householdId?: string;
  status?: string;
  destinationKind?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.householdId) qs.set('householdId', params.householdId);
  if (params?.status) qs.set('status', params.status);
  if (params?.destinationKind) qs.set('destinationKind', params.destinationKind);
  const q = qs.toString();
  return apiFetch<Array<Record<string, unknown>>>(`/referrals${q ? `?${q}` : ''}`, {});
}

export async function fetchReferralInbox(params?: {
  municipalDistrict?: number;
  destinationCode?: string;
  audienceOrganizationId?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.municipalDistrict != null) qs.set('municipalDistrict', String(params.municipalDistrict));
  if (params?.destinationCode) qs.set('destinationCode', params.destinationCode);
  if (params?.audienceOrganizationId) qs.set('audienceOrganizationId', params.audienceOrganizationId);
  const q = qs.toString();
  return apiFetch<Array<Record<string, unknown>>>(`/referrals/inbox${q ? `?${q}` : ''}`, {});
}

export async function createReferral(payload: Record<string, unknown>) {
  return apiFetch('/referrals', { method: 'POST', body: JSON.stringify(payload) });
}

export async function attachReferralConsent(id: string, consentId: string) {
  return apiFetch(`/referrals/${id}/attach-consent`, {
    method: 'POST',
    body: JSON.stringify({ consentId }),
  });
}

export async function sendReferral(id: string) {
  return apiFetch(`/referrals/${id}/send`, { method: 'POST' });
}

export async function updateReferralStatus(id: string, status: ReferralStatus | string, responseNotes?: string) {
  return apiFetch(`/referrals/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, responseNotes }),
  });
}

// --- Field ---
export async function fetchMyVisits() {
  return apiFetch<Array<Record<string, unknown>>>('/field/my-visits', {});
}

export async function fetchFieldToday() {
  return apiFetch<Record<string, number>>('/field/today', {});
}

export async function fieldSearch(q: string) {
  return apiFetch<Array<Record<string, unknown>>>(`/field/search?q=${encodeURIComponent(q)}`, {});
}

export async function completeFieldVisit(visitId: string, payload: Record<string, unknown>) {
  return apiFetch(`/field/visits/${visitId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// --- Portal staff ---
export async function createPortalInvite(payload: Record<string, unknown>) {
  return apiFetch<{ invite: Record<string, unknown>; inviteCode: string }>(
    '/portal/invites',
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export async function fetchPortalInvites(householdId?: string) {
  const qs = householdId ? `?householdId=${householdId}` : '';
  return apiFetch<Array<Record<string, unknown>>>(`/portal/invites${qs}`, {});
}

export async function revokePortalInvite(id: string) {
  return apiFetch(`/portal/invites/${id}/revoke`, { method: 'POST', body: '{}' });
}

export async function revokeConsent(id: string) {
  return apiFetch(`/consents/${id}/revoke`, { method: 'POST', body: '{}' });
}

// --- Portal citizen ---
export async function redeemPortalInvite(inviteCode: string) {
  return apiFetch<{ accessToken: string; summary: PortalHouseholdSummary }>(
    '/portal/redeem',
    { method: 'POST', body: JSON.stringify({ inviteCode }) },
  );
}

export async function fetchPortalSummary() {
  return apiFetch<PortalHouseholdSummary>('/portal/me', {}, portalToken());
}

export async function fetchPortalDocuments() {
  return apiFetch<Array<Record<string, unknown>>>('/portal/me/documents', {}, portalToken());
}

export async function uploadPortalDocument(file: File, title?: string) {
  const t = portalToken();
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  const res = await fetch(`${API_URL}/portal/me/documents`, {
    method: 'POST',
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: form,
  });
  return res.json();
}

export async function downloadPortalDocument(id: string, fileName?: string) {
  const t = portalToken();
  const res = await fetch(`${API_URL}/portal/me/documents/${id}/download`, {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
  if (!res.ok) {
    let message = 'دانلود ناموفق بود';
    try {
      const json = await res.json() as { error?: { message?: string } };
      if (json.error?.message) message = json.error.message;
    } catch {
      /* ignore */
    }
    return { success: false as const, error: { message } };
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { success: true as const };
}

export async function fetchPortalConsents() {
  return apiFetch<Array<Record<string, unknown>>>('/portal/me/consents', {}, portalToken());
}

export async function grantPortalConsent(id: string) {
  return apiFetch(`/portal/me/consents/${id}/grant`, { method: 'POST', body: '{}' }, portalToken());
}

export async function revokePortalConsent(id: string) {
  return apiFetch(`/portal/me/consents/${id}/revoke`, { method: 'POST', body: '{}' }, portalToken());
}

export { ConsentPurpose };
