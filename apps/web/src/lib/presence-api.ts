import { PresenceSnapshot, PRESENCE_HEARTBEAT_INTERVAL_MS } from '@city-manager/shared';
import { apiFetch } from './api';

export { PRESENCE_HEARTBEAT_INTERVAL_MS, PRESENCE_POLL_INTERVAL_MS } from '@city-manager/shared';

export async function sendPresenceHeartbeat() {
  return apiFetch<PresenceSnapshot>('/presence/heartbeat', { method: 'POST' });
}

export async function fetchUsersPresence(ids: string[]) {
  if (ids.length === 0) {
    return { success: true as const, data: {} as Record<string, PresenceSnapshot> };
  }
  const q = new URLSearchParams({ ids: ids.join(',') });
  return apiFetch<Record<string, PresenceSnapshot>>(`/admin/users/presence?${q}`, {});
}

export function presenceStreamUrl(ids: string[]): string {
  const q = new URLSearchParams({ ids: ids.join(',') });
  return `/api/v1/admin/presence/stream?${q.toString()}`;
}
