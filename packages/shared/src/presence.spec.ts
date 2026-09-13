import {
  PRESENCE_AWAY_MS,
  PRESENCE_ONLINE_MS,
  PRESENCE_STATUS_LABELS,
  buildPresenceSnapshot,
  resolvePresenceStatus,
} from './presence';

describe('presence', () => {
  const now = 1_700_000_000_000;

  it('labels all statuses in Persian', () => {
    expect(PRESENCE_STATUS_LABELS.online).toBe('آنلاین');
    expect(PRESENCE_STATUS_LABELS.away).toBe('دور');
    expect(PRESENCE_STATUS_LABELS.offline).toBe('آفلاین');
  });

  it('treats active connection as online regardless of age', () => {
    expect(resolvePresenceStatus(now - PRESENCE_AWAY_MS - 1, true, now)).toBe('online');
  });

  it('uses lastSeen thresholds when no active connection', () => {
    expect(resolvePresenceStatus(now - 30_000, false, now)).toBe('online');
    expect(resolvePresenceStatus(now - PRESENCE_ONLINE_MS, false, now)).toBe('online');
    expect(resolvePresenceStatus(now - PRESENCE_ONLINE_MS - 1, false, now)).toBe('away');
    expect(resolvePresenceStatus(now - PRESENCE_AWAY_MS, false, now)).toBe('away');
    expect(resolvePresenceStatus(now - PRESENCE_AWAY_MS - 1, false, now)).toBe('offline');
    expect(resolvePresenceStatus(null, false, now)).toBe('offline');
  });

  it('builds snapshot with iso lastSeenAt', () => {
    const snap = buildPresenceSnapshot('u1', now - 60_000, 0, now);
    expect(snap.userId).toBe('u1');
    expect(snap.status).toBe('online');
    expect(snap.lastSeenAt).toBe(new Date(now - 60_000).toISOString());
    expect(snap.connections).toBe(0);
  });
});
