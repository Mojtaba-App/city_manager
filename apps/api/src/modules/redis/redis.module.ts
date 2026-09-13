import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private readonly handlers = new Map<string, Set<(message: string) => void>>();

  constructor(private readonly config: ConfigService) {
    const url = (this.config.get<string>('REDIS_URL') ?? '').trim();
    if (!url) {
      this.logger.log('Redis disabled (REDIS_URL not set) — using in-process stores');
      return;
    }
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
      });
      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
      });
      this.client.on('ready', () => this.logger.log('Redis connected'));
      this.subscriber = this.client.duplicate();
      this.subscriber.on('message', (channel, message) => {
        const set = this.handlers.get(channel);
        if (!set) return;
        for (const h of set) h(message);
      });
    } catch (err) {
      this.logger.warn(`Redis init failed: ${err instanceof Error ? err.message : String(err)}`);
      this.client = null;
      this.subscriber = null;
    }
  }

  get enabled(): boolean {
    return Boolean(this.client);
  }

  /** Shared ioredis client for throttler storage, etc. */
  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (ttlSec && ttlSec > 0) await this.client.set(key, value, 'EX', ttlSec);
      else await this.client.set(key, value);
    } catch {
      /* ignore */
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSec);
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch {
      /* ignore */
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.publish(channel, message);
    } catch {
      /* ignore */
    }
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    if (!this.subscriber) return;
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
      try {
        await this.subscriber.subscribe(channel);
      } catch {
        this.handlers.delete(channel);
        return;
      }
    }
    set.add(handler);
  }

  async unsubscribe(channel: string, handler: (message: string) => void): Promise<void> {
    const set = this.handlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(channel);
      try {
        await this.subscriber?.unsubscribe(channel);
      } catch {
        /* ignore */
      }
    }
  }

  onModuleDestroy() {
    void this.subscriber?.quit().catch(() => undefined);
    void this.client?.quit().catch(() => undefined);
    this.subscriber = null;
    this.client = null;
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
