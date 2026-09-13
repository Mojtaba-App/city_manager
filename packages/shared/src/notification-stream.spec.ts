import { encodeSseData, notificationStreamPath, parseSseData } from './notification-stream';

describe('notification stream helpers', () => {
  it('round-trips SSE data', () => {
    const event = { type: 'unread' as const, unreadCount: 4 };
    const parsed = parseSseData(encodeSseData(event));
    expect(parsed).toEqual(event);
  });

  it('builds stream path with access_token', () => {
    expect(notificationStreamPath('abc.def')).toContain('/notifications/stream?');
    expect(notificationStreamPath('abc.def')).toContain('access_token=abc.def');
  });

  it('builds cookie stream path without token in query', () => {
    expect(notificationStreamPath()).toBe('/notifications/stream');
  });
});
