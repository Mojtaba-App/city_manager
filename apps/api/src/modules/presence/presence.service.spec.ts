import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    service = new PresenceService();
  });

  it('marks user online while SSE connection is active', () => {
    service.connect('u1', 'org-1');
    expect(service.snapshot('u1').status).toBe('online');
    expect(service.snapshot('u1').connections).toBe(1);
  });

  it('transitions to away then offline after disconnect', () => {
    const now = Date.now();
    service.connect('u1');
    service.disconnect('u1');
    const snapAway = service.snapshot('u1', now + 120_000);
    expect(snapAway.status).toBe('away');
    const snapOffline = service.snapshot('u1', now + 400_000);
    expect(snapOffline.status).toBe('offline');
  });

  it('heartbeat touch keeps user online without open connection', () => {
    const now = Date.now();
    service.touch('u2', 'org-1');
    expect(service.snapshot('u2', now + 60_000).status).toBe('online');
    expect(service.snapshot('u2', now + 200_000).status).toBe('away');
  });

  it('returns bulk snapshots for requested ids', () => {
    service.connect('a');
    service.touch('b');
    const bulk = service.bulk(['a', 'b', 'missing']);
    expect(bulk.a.status).toBe('online');
    expect(bulk.b.status).toBe('online');
    expect(bulk.missing.status).toBe('offline');
  });

  it('notifies listener on status change', () => {
    const events: Array<{ status: string }> = [];
    service.setChangeNotifier((snap) => events.push(snap));
    service.connect('u1', 'org-1');
    expect(events.some((e) => e.status === 'online')).toBe(true);
    service.disconnect('u1');
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('skips notifier when status unchanged on heartbeat touch', () => {
    const events: unknown[] = [];
    service.setChangeNotifier((snap) => events.push(snap));
    service.touch('u2', 'org-1');
    events.length = 0;
    service.touch('u2', 'org-1');
    expect(events).toHaveLength(0);
  });
});
