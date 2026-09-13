import { Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { buildPresenceSnapshot, type PresenceSnapshot } from '@city-manager/shared';
import { RedisService } from '../redis/redis.module';

interface PresenceEntry {
  lastSeen: number;
  connections: number;
  organizationId?: string | null;
}

type ChangeNotifier = (
  snapshot: PresenceSnapshot,
  organizationId?: string | null,
) => void;

const KEY = (userId: string) => `cm:presence:${userId}`;
const PRESENCE_TTL_SEC = 180;

@Injectable()
export class PresenceService {
  private readonly entries = new Map<string, PresenceEntry>();
  private changeNotifier?: ChangeNotifier;

  constructor(
    @Optional() private readonly redis?: RedisService,
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
  ) {}

  setChangeNotifier(notifier: ChangeNotifier): void {
    this.changeNotifier = notifier;
  }

  touch(userId: string, organizationId?: string | null): void {
    void this.mutate(userId, organizationId, (entry) => {
      entry.lastSeen = Date.now();
      if (organizationId !== undefined) entry.organizationId = organizationId;
    }, true);
    void this.persistLastSeen(userId);
  }

  connect(userId: string, organizationId?: string | null): void {
    void this.mutate(userId, organizationId, (entry) => {
      entry.connections += 1;
      entry.lastSeen = Date.now();
      if (organizationId !== undefined) entry.organizationId = organizationId;
    }, true);
  }

  disconnect(userId: string): void {
    void this.mutate(userId, undefined, (entry) => {
      entry.connections = Math.max(0, entry.connections - 1);
      entry.lastSeen = Date.now();
    }, false);
  }

  getOrganizationId(userId: string): string | null | undefined {
    return this.entries.get(userId)?.organizationId;
  }

  snapshot(userId: string, now = Date.now()): PresenceSnapshot {
    const entry = this.entries.get(userId);
    if (!entry) {
      return buildPresenceSnapshot(userId, null, 0, now);
    }
    return buildPresenceSnapshot(userId, entry.lastSeen, entry.connections, now);
  }

  bulk(userIds: string[], now = Date.now()): Record<string, PresenceSnapshot> {
    const out: Record<string, PresenceSnapshot> = {};
    for (const id of userIds) {
      out[id] = this.snapshot(id, now);
    }
    // hydrate from redis asynchronously when available
    if (this.redis?.enabled) {
      void this.hydrateMany(userIds).then(() => {
        /* next poll/SSE will see updated local cache */
      });
    }
    return out;
  }

  /** Test helper — not for production controllers */
  clear(): void {
    this.entries.clear();
  }

  private async hydrateMany(userIds: string[]): Promise<void> {
    if (!this.redis?.enabled) return;
    await Promise.all(userIds.map(async (id) => {
      const remote = await this.redis!.getJson<PresenceEntry>(KEY(id));
      if (remote) this.entries.set(id, remote);
    }));
  }

  private async mutate(
    userId: string,
    organizationId: string | null | undefined,
    apply: (entry: PresenceEntry) => void,
    createIfMissing: boolean,
  ): Promise<void> {
    const before = this.snapshot(userId);
    let entry = this.entries.get(userId);
    if (!entry && this.redis?.enabled) {
      entry = (await this.redis.getJson<PresenceEntry>(KEY(userId))) ?? undefined;
      if (entry) this.entries.set(userId, entry);
    }
    if (!entry) {
      if (!createIfMissing) return;
      entry = {
        lastSeen: Date.now(),
        connections: 0,
        organizationId,
      };
      this.entries.set(userId, entry);
    }
    apply(entry);
    if (this.redis?.enabled) {
      await this.redis.setJson(KEY(userId), entry, PRESENCE_TTL_SEC);
    }
    this.notifyIfChanged(userId, before);
  }

  private notifyIfChanged(userId: string, before: PresenceSnapshot): void {
    if (!this.changeNotifier) return;
    const after = this.snapshot(userId);
    if (
      before.status === after.status
      && before.connections === after.connections
    ) {
      return;
    }
    const entry = this.entries.get(userId);
    this.changeNotifier(after, entry?.organizationId);
  }

  private async persistLastSeen(userId: string): Promise<void> {
    if (!this.dataSource) return;
    try {
      await this.dataSource.query(
        `UPDATE core.users SET last_seen_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
        [userId],
      );
    } catch {
      /* column may not exist until Phase 3 migration */
    }
  }
}
