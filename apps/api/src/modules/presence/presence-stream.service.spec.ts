import { PresenceStreamService } from './presence-stream.service';
import { PresenceService } from './presence.service';
import { SystemRole, type JwtPayload } from '@city-manager/shared';

function admin(orgId = 'org-1'): JwtPayload {
  return {
    sub: 'admin-1',
    email: 'admin@example.com',
    orgId,
    roles: [SystemRole.ORG_ADMIN],
    permissions: [],
  };
}

describe('PresenceStreamService', () => {
  let presence: PresenceService;
  let stream: PresenceStreamService;

  beforeEach(() => {
    presence = new PresenceService();
    stream = new PresenceStreamService(presence);
    stream.onModuleInit();
  });

  afterEach(() => {
    stream.onModuleDestroy();
  });

  it('sends initial snapshot to subscribers', () => {
    presence.connect('u1', 'org-1');
    const received: unknown[] = [];
    const sub = stream.subscribe(admin(), ['u1'], presence.bulk(['u1'])).subscribe((ev) => {
      received.push(ev.data);
    });
    expect(received[0]).toMatchObject({
      type: 'snapshot',
      data: { u1: expect.objectContaining({ status: 'online' }) },
    });
    sub.unsubscribe();
  });

  it('pushes presence updates when user connects', () => {
    const received: unknown[] = [];
    const sub = stream.subscribe(admin(), ['u1'], {}).subscribe((ev) => {
      received.push(ev.data);
    });
    presence.connect('u1', 'org-1');
    expect(received.some((e) => (
      typeof e === 'object'
      && e !== null
      && (e as { type?: string }).type === 'presence'
      && (e as { snapshot?: { status?: string } }).snapshot?.status === 'online'
    ))).toBe(true);
    sub.unsubscribe();
  });

  it('does not notify org admin for users outside org', () => {
    const received: unknown[] = [];
    const sub = stream.subscribe(admin('org-1'), ['u1'], {}).subscribe((ev) => {
      if ((ev.data as { type?: string }).type === 'presence') received.push(ev.data);
    });
    presence.connect('u1', 'org-2');
    expect(received).toHaveLength(0);
    sub.unsubscribe();
  });

  it('notifies super admin across orgs', () => {
    const received: unknown[] = [];
    const superAdmin: JwtPayload = {
      sub: 'sa',
      email: 'sa@example.com',
      orgId: 'org-1',
      roles: [SystemRole.SUPER_ADMIN],
      permissions: [],
    };
    const sub = stream.subscribe(superAdmin, ['u1'], {}).subscribe((ev) => {
      if ((ev.data as { type?: string }).type === 'presence') received.push(ev.data);
    });
    presence.connect('u1', 'org-2');
    expect(received.length).toBeGreaterThan(0);
    sub.unsubscribe();
  });
});
