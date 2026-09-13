import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { resolveCryptoSecret } from '../../../common/crypto-secret';

@Injectable()
export class SecretsCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = resolveCryptoSecret(
      config,
      ['INTEGRATION_ENC_KEY', 'PII_ENC_KEY', 'JWT_SECRET'],
      'integration secrets',
    );
    this.key = crypto.createHash('sha256').update(`integration:${secret}`).digest();
  }

  encryptJson(value: Record<string, unknown>): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson(payload: string): Record<string, unknown> {
    return JSON.parse(this.decrypt(payload)) as Record<string, unknown>;
  }

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  hmacSha256(secret: string, body: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  /** Constant-time compare for hex digests (or any equal-length strings). */
  equalHexTimingSafe(a: string, b: string): boolean {
    try {
      const left = Buffer.from(String(a), 'utf8');
      const right = Buffer.from(String(b), 'utf8');
      if (left.length !== right.length) return false;
      return crypto.timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }
}
