import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  DEFAULT_FIELD_RULES,
  FieldProtectionRule,
  JwtPayload,
  MaskMode,
} from '@city-manager/shared';

@Injectable()
export class FieldMaskingService {
  /**
   * Field-level protection: mask/anonymize fields the subject cannot read.
   * Does not decrypt — expects plaintext or already-decrypted values.
   */
  protectRecord(
    record: Record<string, unknown>,
    user: JwtPayload,
    rules: FieldProtectionRule[] = DEFAULT_FIELD_RULES,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...record };
    for (const rule of rules) {
      if (!(rule.field in out) || out[rule.field] == null) continue;
      const allowed = user.permissions.includes(rule.requiredPermission as never);
      if (allowed) continue;
      out[rule.field] = this.mask(String(out[rule.field]), rule.mask);
    }
    return out;
  }

  protectMany(
    rows: Record<string, unknown>[],
    user: JwtPayload,
    rules?: FieldProtectionRule[],
  ): Record<string, unknown>[] {
    return rows.map((r) => this.protectRecord(r, user, rules));
  }

  mask(value: string, mode: MaskMode): string | null {
    if (!value) return value;
    switch (mode) {
      case 'none':
        return value;
      case 'redact':
        return null;
      case 'hash':
        return `sha256:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
      case 'partial':
        return this.partialMask(value);
      default:
        return '***';
    }
  }

  /** Anonymize for analytics export — irreversible */
  anonymize(value: string, salt = 'city-manager'): string {
    return crypto.createHmac('sha256', salt).update(value.trim()).digest('hex').slice(0, 24);
  }

  /** Strip secrets from audit payloads */
  sanitizePayload(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!payload) return undefined;
    const SENSITIVE = /password|secret|token|authorization|national.?id|iban|ciphertext|api.?key/i;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (SENSITIVE.test(k)) {
        out[k] = '[REDACTED]';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.sanitizePayload(v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private partialMask(value: string): string {
    const v = value.trim();
    if (v.length <= 4) return '****';
    if (v.includes('@')) {
      const [u, d] = v.split('@');
      return `${u.slice(0, 1)}***@${d}`;
    }
    return `${v.slice(0, 2)}${'*'.repeat(Math.min(v.length - 4, 8))}${v.slice(-2)}`;
  }
}
