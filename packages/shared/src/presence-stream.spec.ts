import {
  encodePresenceStreamData,
  parsePresenceStreamData,
  presenceStreamPath,
} from './presence-stream';
import { buildPresenceSnapshot } from './presence';

describe('presence stream helpers', () => {
  it('round-trips SSE data', () => {
    const snap = buildPresenceSnapshot('u1', Date.now(), 1);
    const event = { type: 'presence' as const, snapshot: snap };
    const parsed = parsePresenceStreamData(encodePresenceStreamData(event));
    expect(parsed).toEqual(event);
  });

  it('parses raw JSON event payloads', () => {
    const event = { type: 'ping' as const };
    expect(parsePresenceStreamData(JSON.stringify(event))).toEqual(event);
  });

  it('builds stream path with ids', () => {
    const path = presenceStreamPath(['a', 'b']);
    expect(path).toContain('/admin/presence/stream?');
    expect(path).toContain('ids=a%2Cb');
  });
});
