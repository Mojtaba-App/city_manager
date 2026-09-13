import { Injectable, MessageEvent, OnModuleDestroy, Optional } from '@nestjs/common';
import { Observable, Subject, interval, merge, map } from 'rxjs';
import { PresenceService } from '../../presence/presence.service';
import { RedisService } from '../../redis/redis.module';

export type NotificationStreamPayload =
  | { type: 'ping' }
  | { type: 'notification'; unreadCount: number; item: Record<string, unknown> };

const channelFor = (userId: string) => `cm:notify:${userId}`;

@Injectable()
export class NotificationStreamService implements OnModuleDestroy {
  private readonly channels = new Map<string, Set<Subject<MessageEvent>>>();
  private readonly redisHandlers = new Map<string, (message: string) => void>();

  constructor(
    @Optional() private readonly presence?: PresenceService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  subscribe(
    userId: string,
    organizationId?: string | null,
    heartbeatMs = 25_000,
  ): Observable<MessageEvent> {
    this.presence?.connect(userId, organizationId);
    void this.ensureRedisSubscription(userId);

    return new Observable((subscriber) => {
      const subject = new Subject<MessageEvent>();
      let set = this.channels.get(userId);
      if (!set) {
        set = new Set();
        this.channels.set(userId, set);
      }
      set.add(subject);

      const heartbeat = interval(heartbeatMs).pipe(
        map((): MessageEvent => {
          this.presence?.touch(userId, organizationId);
          return { data: { type: 'ping' } satisfies NotificationStreamPayload };
        }),
      );

      const inner = merge(subject, heartbeat).subscribe(subscriber);

      return () => {
        inner.unsubscribe();
        set.delete(subject);
        if (set.size === 0) {
          this.channels.delete(userId);
          void this.dropRedisSubscription(userId);
        }
        subject.complete();
        this.presence?.disconnect(userId);
      };
    });
  }

  publish(userId: string, payload: NotificationStreamPayload): number {
    const delivered = this.deliverLocal(userId, payload);
    if (this.redis?.enabled) {
      void this.redis.publish(channelFor(userId), JSON.stringify(payload));
    }
    return delivered;
  }

  subscriberCount(userId?: string): number {
    if (userId) return this.channels.get(userId)?.size ?? 0;
    let total = 0;
    for (const s of this.channels.values()) total += s.size;
    return total;
  }

  onModuleDestroy() {
    for (const set of this.channels.values()) {
      for (const subject of set) subject.complete();
    }
    this.channels.clear();
    for (const [userId] of this.redisHandlers) {
      void this.dropRedisSubscription(userId);
    }
  }

  private deliverLocal(userId: string, payload: NotificationStreamPayload): number {
    const set = this.channels.get(userId);
    if (!set || set.size === 0) return 0;
    const event: MessageEvent = { data: payload };
    for (const subject of set) subject.next(event);
    return set.size;
  }

  private async ensureRedisSubscription(userId: string): Promise<void> {
    if (!this.redis?.enabled || this.redisHandlers.has(userId)) return;
    const handler = (message: string) => {
      try {
        const payload = JSON.parse(message) as NotificationStreamPayload;
        this.deliverLocal(userId, payload);
      } catch {
        /* ignore */
      }
    };
    this.redisHandlers.set(userId, handler);
    await this.redis.subscribe(channelFor(userId), handler);
  }

  private async dropRedisSubscription(userId: string): Promise<void> {
    const handler = this.redisHandlers.get(userId);
    if (!handler || !this.redis?.enabled) return;
    this.redisHandlers.delete(userId);
    await this.redis.unsubscribe(channelFor(userId), handler);
  }
}
