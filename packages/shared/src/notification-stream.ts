export type NotificationStreamEvent =
  | { type: 'notification'; unreadCount: number; notification: Record<string, unknown> }
  | { type: 'unread'; unreadCount: number }
  | { type: 'ping' };

export function encodeSseData(event: NotificationStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSseData(raw: string): NotificationStreamEvent | null {
  const line = raw.split('\n').find((l) => l.startsWith('data:'));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(5).trim()) as NotificationStreamEvent;
  } catch {
    return null;
  }
}

export function notificationStreamPath(token?: string): string {
  if (!token) return '/notifications/stream';
  const q = new URLSearchParams({ access_token: token });
  return `/notifications/stream?${q.toString()}`;
}

export function notificationCookieStreamPath(): string {
  return '/notifications/stream';
}
