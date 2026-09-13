import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { resolveCryptoSecret } from '../../../common/crypto-secret';

@Injectable()
export class PiiCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = resolveCryptoSecret(config, ['PII_ENC_KEY', 'JWT_SECRET'], 'PII encryption');
    this.key = crypto.createHash('sha256').update(secret).digest();
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

  hash(value: string): string {
    return crypto.createHash('sha256').update(value.trim()).digest('hex');
  }
}
