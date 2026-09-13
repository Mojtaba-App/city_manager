import { Injectable, OnModuleDestroy, Optional, UnauthorizedException } from '@nestjs/common';
import {
  LOGIN_CONTACT_ADMIN_MESSAGE,
  LOGIN_FAIL_LIMIT,
  LOGIN_LOCK_MS,
  loginLockMessage,
} from '@city-manager/shared';
import { RedisService } from '../redis/redis.module';

export interface LoginLockState {
  fails: number;
  lockRounds: number;
  lockedUntil: number;
  contactAdmin: boolean;
}

export class LoginLockedException extends UnauthorizedException {
  constructor(retryAfterSec: number, contactAdmin: boolean) {
    super({
      statusCode: 401,
      error: 'Unauthorized',
      code: contactAdmin ? 'LOGIN_CONTACT_ADMIN' : 'LOGIN_LOCKED',
      message: contactAdmin
        ? LOGIN_CONTACT_ADMIN_MESSAGE
        : loginLockMessage(retryAfterSec, false),
      retryAfterSec,
      contactAdmin,
    });
  }
}

const KEY = (key: string) => `cm:lock:${key}`;

@Injectable()
export class LoginLockoutService implements OnModuleDestroy {
  private readonly entries = new Map<string, LoginLockState>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(@Optional() private readonly redis?: RedisService) {
    this.cleanupTimer = setInterval(() => this.purge(), 60_000);
  }

  keyFor(identifier: string, ip?: string): string {
    return `${identifier.trim().toLowerCase()}|${ip ?? ''}`;
  }

  async assertUnlocked(key: string): Promise<void> {
    const state = await this.read(key);
    if (!state) return;
    const now = Date.now();
    if (state.lockedUntil > now) {
      const retryAfterSec = Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
      throw new LoginLockedException(retryAfterSec, state.contactAdmin);
    }
  }

  async recordFailure(key: string): Promise<LoginLockState> {
    const now = Date.now();
    const prev = (await this.read(key)) ?? {
      fails: 0,
      lockRounds: 0,
      lockedUntil: 0,
      contactAdmin: false,
    };
    if (prev.lockedUntil > now) {
      throw new LoginLockedException(
        Math.max(1, Math.ceil((prev.lockedUntil - now) / 1000)),
        prev.contactAdmin,
      );
    }

    const fails = prev.fails + 1;
    if (fails < LOGIN_FAIL_LIMIT) {
      const next = { ...prev, fails, lockedUntil: 0 };
      await this.write(key, next);
      return next;
    }

    const lockRounds = prev.lockRounds + 1;
    const contactAdmin = lockRounds >= 2;
    const next: LoginLockState = {
      fails: 0,
      lockRounds,
      lockedUntil: now + LOGIN_LOCK_MS,
      contactAdmin,
    };
    await this.write(key, next, Math.ceil(LOGIN_LOCK_MS / 1000) + 3600);
    throw new LoginLockedException(Math.ceil(LOGIN_LOCK_MS / 1000), contactAdmin);
  }

  async recordSuccess(key: string): Promise<void> {
    this.entries.delete(key);
    if (this.redis?.enabled) await this.redis.del(KEY(key));
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.entries.clear();
  }

  private async read(key: string): Promise<LoginLockState | undefined> {
    if (this.redis?.enabled) {
      const state = await this.redis.getJson<LoginLockState>(KEY(key));
      if (state) {
        this.entries.set(key, state);
        return state;
      }
    }
    return this.entries.get(key);
  }

  private async write(key: string, state: LoginLockState, ttlSec = 7200): Promise<void> {
    this.entries.set(key, state);
    if (this.redis?.enabled) await this.redis.setJson(KEY(key), state, ttlSec);
  }

  private purge() {
    const now = Date.now();
    for (const [key, state] of this.entries) {
      if (state.lockedUntil && state.lockedUntil < now && !state.contactAdmin && state.fails === 0) {
        this.entries.set(key, { ...state, lockedUntil: 0 });
      }
    }
  }
}
