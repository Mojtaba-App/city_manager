import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { LOGIN_OTP_RESEND_MS, LOGIN_OTP_TTL_MS } from '@city-manager/shared';
import { RedisService } from '../redis/redis.module';

export interface LoginOtpChallenge {
  id: string;
  userId: string;
  codeHash: string;
  maskedPhone: string;
  plainCode?: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const OTP_MAX_ATTEMPTS = 5;
const KEY = (id: string) => `cm:otp:${id}`;
const USER_KEY = (userId: string) => `cm:otp:user:${userId}`;

@Injectable()
export class LoginOtpService implements OnModuleDestroy {
  private readonly challenges = new Map<string, LoginOtpChallenge>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(@Optional() private readonly redis?: RedisService) {
    this.cleanupTimer = setInterval(() => this.purgeExpired(), 60_000);
  }

  async create(userId: string, maskedPhone: string): Promise<LoginOtpChallenge> {
    await this.purgeForUser(userId);
    return this.storeNew(userId, maskedPhone);
  }

  async resend(
    challengeId: string,
  ): Promise<{ ok: true; challenge: LoginOtpChallenge } | { ok: false; reason: string; retryAfterSec?: number }> {
    const existing = await this.get(challengeId);
    if (!existing) return { ok: false, reason: 'کد تأیید منقضی یا نامعتبر است' };
    const waitMs = existing.lastSentAt + LOGIN_OTP_RESEND_MS - Date.now();
    if (waitMs > 0) {
      return {
        ok: false,
        reason: 'ارسال مجدد هنوز ممکن نیست',
        retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)),
      };
    }
    await this.deleteChallenge(existing);
    const next = await this.storeNew(existing.userId, existing.maskedPhone);
    return { ok: true, challenge: next };
  }

  async verify(
    challengeId: string,
    code: string,
  ): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
    const challenge = await this.get(challengeId);
    if (!challenge) return { ok: false, reason: 'کد تأیید منقضی یا نامعتبر است' };
    if (challenge.expiresAt < Date.now()) {
      await this.deleteChallenge(challenge);
      return { ok: false, reason: 'کد تأیید منقضی شده است' };
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await this.deleteChallenge(challenge);
      return { ok: false, reason: 'تعداد تلاش بیش از حد مجاز است' };
    }
    challenge.attempts += 1;
    await this.persist(challenge);
    if (this.hash(String(code).trim()) !== challenge.codeHash) {
      return { ok: false, reason: 'کد تأیید نادرست است' };
    }
    await this.deleteChallenge(challenge);
    return { ok: true, userId: challenge.userId };
  }

  async get(challengeId: string): Promise<LoginOtpChallenge | undefined> {
    if (this.redis?.enabled) {
      const c = await this.redis.getJson<LoginOtpChallenge>(KEY(challengeId));
      if (!c) return undefined;
      if (c.expiresAt < Date.now()) {
        await this.redis.del(KEY(challengeId), USER_KEY(c.userId));
        return undefined;
      }
      this.challenges.set(c.id, c);
      return c;
    }
    const c = this.challenges.get(challengeId);
    if (!c) return undefined;
    if (c.expiresAt < Date.now()) {
      this.challenges.delete(challengeId);
      return undefined;
    }
    return c;
  }

  resendAfterSec(challenge: LoginOtpChallenge): number {
    return Math.max(0, Math.ceil((challenge.lastSentAt + LOGIN_OTP_RESEND_MS - Date.now()) / 1000));
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.challenges.clear();
  }

  private async storeNew(userId: string, maskedPhone: string): Promise<LoginOtpChallenge> {
    const code = String(crypto.randomInt(100000, 1000000));
    const now = Date.now();
    const challenge: LoginOtpChallenge = {
      id: crypto.randomUUID(),
      userId,
      codeHash: this.hash(code),
      maskedPhone,
      plainCode: code,
      expiresAt: now + LOGIN_OTP_TTL_MS,
      lastSentAt: now,
      attempts: 0,
    };
    await this.persist(challenge);
    return challenge;
  }

  private async persist(challenge: LoginOtpChallenge): Promise<void> {
    this.challenges.set(challenge.id, challenge);
    if (!this.redis?.enabled) return;
    const ttlSec = Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000));
    await this.redis.setJson(KEY(challenge.id), challenge, ttlSec);
    await this.redis.set(USER_KEY(challenge.userId), challenge.id, ttlSec);
  }

  private async deleteChallenge(challenge: LoginOtpChallenge): Promise<void> {
    this.challenges.delete(challenge.id);
    if (this.redis?.enabled) {
      await this.redis.del(KEY(challenge.id), USER_KEY(challenge.userId));
    }
  }

  private hash(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async purgeForUser(userId: string) {
    if (this.redis?.enabled) {
      const id = await this.redis.get(USER_KEY(userId));
      if (id) await this.redis.del(KEY(id), USER_KEY(userId));
    }
    for (const [id, c] of this.challenges) {
      if (c.userId === userId) this.challenges.delete(id);
    }
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [id, c] of this.challenges) {
      if (c.expiresAt < now) this.challenges.delete(id);
    }
  }
}
