import type { PresenceSnapshot } from './presence';

export type PresenceStreamEvent =
  | { type: 'ping' }
  | { type: 'snapshot'; data: Record<string, PresenceSnapshot> }
  | { type: 'presence'; snapshot: PresenceSnapshot };

/** Server-side re-check for online → away → offline without client polling */
export const PRESENCE_STREAM_EXPIRY_CHECK_MS = 30_000;

export function encodePresenceStreamData(event: PresenceStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parsePresenceStreamData(raw: string): PresenceStreamEvent | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const json = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  try {
    return JSON.parse(json) as PresenceStreamEvent;
  } catch {
    return null;
  }
}

export function presenceStreamPath(ids: string[]): string {
  const q = new URLSearchParams({ ids: ids.join(',') });
  return `/admin/presence/stream?${q.toString()}`;
}

export function presenceCookieStreamPath(ids: string[]): string {
  return presenceStreamPath(ids);
}
