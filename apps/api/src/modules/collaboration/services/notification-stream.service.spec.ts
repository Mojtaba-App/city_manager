import { NotificationStreamService } from './notification-stream.service';
import { PresenceService } from '../../presence/presence.service';

describe('NotificationStreamService', () => {
  let hub: NotificationStreamService;
  let presence: PresenceService;

  beforeEach(() => {
    presence = new PresenceService();
    hub = new NotificationStreamService(presence);
  });

  afterEach(() => {
    hub.onModuleDestroy();
  });

  it('delivers published events to subscribers', () => {
    const received: unknown[] = [];
    const sub = hub.subscribe('u1', null, 60_000).subscribe((event) => {
      received.push(event.data);
    });
    const sent = hub.publish('u1', {
      type: 'notification',
      unreadCount: 2,
      item: { id: 'n1', title: 'وظیفه جدید' },
    });
    expect(sent).toBe(1);
    expect(received[0]).toMatchObject({ type: 'notification', unreadCount: 2 });
    sub.unsubscribe();
    expect(hub.subscriberCount('u1')).toBe(0);
  });

  it('does not leak events across users', () => {
    const sub = hub.subscribe('u1', null, 60_000).subscribe();
    expect(hub.publish('u2', { type: 'ping' })).toBe(0);
    expect(hub.subscriberCount('u1')).toBe(1);
    expect(hub.subscriberCount('u2')).toBe(0);
    sub.unsubscribe();
  });

  it('marks user online while notification stream is connected', () => {
    const sub = hub.subscribe('u1', 'org-1', 60_000).subscribe();
    expect(presence.snapshot('u1').status).toBe('online');
    expect(presence.snapshot('u1').connections).toBe(1);
    sub.unsubscribe();
    expect(presence.snapshot('u1').connections).toBe(0);
  });
});
