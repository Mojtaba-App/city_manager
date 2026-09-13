import { Injectable, MessageEvent, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Observable, Subject, interval, merge, map } from 'rxjs';
import {
  JwtPayload,
  PRESENCE_STREAM_EXPIRY_CHECK_MS,
  SystemRole,
  type PresenceSnapshot,
} from '@city-manager/shared';
import { PresenceService } from './presence.service';

type PresenceStreamPayload =
  | { type: 'ping' }
  | { type: 'snapshot'; data: Record<string, PresenceSnapshot> }
  | { type: 'presence'; snapshot: PresenceSnapshot };

interface Subscriber {
  orgScope: string | null;
  watchedIds: Set<string>;
  subject: Subject<MessageEvent>;
}

function orgScope(user: JwtPayload): string | null {
  return user.roles.includes(SystemRole.SUPER_ADMIN) ? null : user.orgId ?? null;
}

@Injectable()
export class PresenceStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly subscribers = new Set<Subscriber>();
  private readonly lastPublished = new Map<string, string>();
  private expiryTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly presence: PresenceService) {}

  onModuleInit() {
    this.presence.setChangeNotifier((snapshot, organizationId) => {
      this.publishSnapshot(snapshot, organizationId ?? null);
    });
    this.expiryTimer = setInterval(
      () => this.checkExpiry(),
      PRESENCE_STREAM_EXPIRY_CHECK_MS,
    );
  }

  subscribe(
    user: JwtPayload,
    watchedIds: string[],
    initialData: Record<string, PresenceSnapshot>,
    heartbeatMs = 25_000,
  ): Observable<MessageEvent> {
    const scope = orgScope(user);
    const watched = new Set(watchedIds);

    return new Observable((subscriber) => {
      const subject = new Subject<MessageEvent>();
      const sub: Subscriber = { orgScope: scope, watchedIds: watched, subject };
      this.subscribers.add(sub);

      subscriber.next({
        data: { type: 'snapshot', data: initialData } satisfies PresenceStreamPayload,
      });
      for (const snap of Object.values(initialData)) {
        this.rememberPublished(snap);
      }

      const heartbeat = interval(heartbeatMs).pipe(
        map((): MessageEvent => ({ data: { type: 'ping' } satisfies PresenceStreamPayload })),
      );

      const inner = merge(subject, heartbeat).subscribe(subscriber);

      return () => {
        inner.unsubscribe();
        this.subscribers.delete(sub);
        subject.complete();
      };
    });
  }

  publishSnapshot(snapshot: PresenceSnapshot, userOrgId: string | null): number {
    if (!this.shouldPublish(snapshot)) return 0;

    const payload: PresenceStreamPayload = { type: 'presence', snapshot };
    let sent = 0;
    for (const sub of this.subscribers) {
      if (!this.shouldNotify(sub, snapshot.userId, userOrgId)) continue;
      sub.subject.next({ data: payload });
      sent += 1;
    }
    return sent;
  }

  subscriberCount(): number {
    return this.subscribers.size;
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
    for (const sub of this.subscribers) sub.subject.complete();
    this.subscribers.clear();
    this.lastPublished.clear();
  }

  private shouldPublish(snapshot: PresenceSnapshot): boolean {
    const key = this.snapshotKey(snapshot);
    if (this.lastPublished.get(snapshot.userId) === key) return false;
    this.lastPublished.set(snapshot.userId, key);
    return true;
  }

  private rememberPublished(snapshot: PresenceSnapshot): void {
    this.lastPublished.set(snapshot.userId, this.snapshotKey(snapshot));
  }

  private shouldNotify(sub: Subscriber, userId: string, userOrgId: string | null): boolean {
    if (!sub.watchedIds.has(userId)) return false;
    if (sub.orgScope === null) return true;
    return userOrgId === sub.orgScope;
  }

  private snapshotKey(s: PresenceSnapshot): string {
    return `${s.status}|${s.connections}|${s.lastSeenAt ?? ''}`;
  }

  private checkExpiry(): void {
    const watched = new Set<string>();
    for (const sub of this.subscribers) {
      for (const id of sub.watchedIds) watched.add(id);
    }
    for (const userId of watched) {
      const snapshot = this.presence.snapshot(userId);
      const userOrgId = this.presence.getOrganizationId(userId) ?? null;
      this.publishSnapshot(snapshot, userOrgId);
    }
  }
}
