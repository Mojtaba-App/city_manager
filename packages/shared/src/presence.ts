export type PresenceStatus = 'online' | 'away' | 'offline';

/** Active SSE or recent heartbeat — treated as online */
export const PRESENCE_ONLINE_MS = 90_000;

/** Recent activity window before offline */
export const PRESENCE_AWAY_MS = 300_000;

export const PRESENCE_HEARTBEAT_INTERVAL_MS = 45_000;

export const PRESENCE_POLL_INTERVAL_MS = 30_000;
/** Fallback poll interval when notification SSE is unavailable */
export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;

export const PRESENCE_STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'آنلاین',
  away: 'دور',
  offline: 'آفلاین',
};

export interface PresenceSnapshot {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
  connections: number;
}

export function resolvePresenceStatus(
  lastSeenMs: number | null | undefined,
  hasActiveConnection: boolean,
  now = Date.now(),
): PresenceStatus {
  if (hasActiveConnection) return 'online';
  if (lastSeenMs == null || !Number.isFinite(lastSeenMs)) return 'offline';
  const age = now - lastSeenMs;
  if (age <= PRESENCE_ONLINE_MS) return 'online';
  if (age <= PRESENCE_AWAY_MS) return 'away';
  return 'offline';
}

export function buildPresenceSnapshot(
  userId: string,
  lastSeenMs: number | null | undefined,
  connections: number,
  now = Date.now(),
): PresenceSnapshot {
  const hasConnection = connections > 0;
  return {
    userId,
    status: resolvePresenceStatus(lastSeenMs, hasConnection, now),
    lastSeenAt: lastSeenMs != null && Number.isFinite(lastSeenMs)
      ? new Date(lastSeenMs).toISOString()
      : null,
    connections: Math.max(0, connections),
  };
}
