import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SecretMetaDto } from '@city-manager/shared';
import { ManagedSecret } from '../entities/managed-secret.entity';
import { resolveCryptoSecret } from '../../../common/crypto-secret';

/**
 * Central secret management: AES-256-GCM at rest, versioned keys, never returns plaintext via API.
 */
@Injectable()
export class SecretVaultService {
  private readonly masterKey: Buffer;

  constructor(
    @InjectRepository(ManagedSecret)
    private readonly repo: Repository<ManagedSecret>,
    config: ConfigService,
  ) {
    const secret = resolveCryptoSecret(
      config,
      ['SECRETS_MASTER_KEY', 'PII_ENC_KEY', 'JWT_SECRET'],
      'secret vault master',
    );
    this.masterKey = crypto.createHash('sha256').update(`vault:v1:${secret}`).digest();
  }

  async list(orgId: string): Promise<SecretMetaDto[]> {
    const rows = await this.repo.find({
      where: { organizationId: orgId },
      order: { key: 'ASC' },
    });
    return rows.map((r) => this.toMeta(r));
  }

  async upsert(
    orgId: string,
    key: string,
    value: string,
    description: string | undefined,
    userId: string,
  ): Promise<SecretMetaDto> {
    if (!key?.trim() || !value) {
      throw new BadRequestException('کلید و مقدار الزامی است');
    }
    let row = await this.repo.findOne({ where: { organizationId: orgId, key } });
    const ciphertext = this.encrypt(value);
    if (row) {
      row.ciphertext = ciphertext;
      row.keyVersion += 1;
      row.rotatedAt = new Date();
      row.description = description ?? row.description;
    } else {
      row = this.repo.create({
        organizationId: orgId,
        key,
        description,
        ciphertext,
        keyVersion: 1,
        createdBy: userId,
      });
    }
    const saved = await this.repo.save(row);
    return this.toMeta(saved);
  }

  async rotate(orgId: string, key: string, newValue: string): Promise<SecretMetaDto> {
    const row = await this.repo.findOne({ where: { organizationId: orgId, key } });
    if (!row) throw new NotFoundException('راز یافت نشد');
    row.ciphertext = this.encrypt(newValue);
    row.keyVersion += 1;
    row.rotatedAt = new Date();
    return this.toMeta(await this.repo.save(row));
  }

  /** Internal use only — integrations / workers */
  async reveal(orgId: string, key: string): Promise<string> {
    const row = await this.repo.findOne({ where: { organizationId: orgId, key } });
    if (!row) throw new NotFoundException('راز یافت نشد');
    return this.decrypt(row.ciphertext);
  }

  async remove(orgId: string, key: string): Promise<void> {
    await this.repo.delete({ organizationId: orgId, key });
  }

  async count(orgId: string | null): Promise<number> {
    if (orgId) return this.repo.count({ where: { organizationId: orgId } });
    return this.repo.count();
  }

  private toMeta(r: ManagedSecret): SecretMetaDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      key: r.key,
      description: r.description,
      keyVersion: r.keyVersion,
      rotatedAt: r.rotatedAt?.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      hasValue: Boolean(r.ciphertext),
    };
  }

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // version prefix for future key rotation of master
    return `v1:${Buffer.concat([iv, tag, enc]).toString('base64')}`;
  }

  private decrypt(payload: string): string {
    const raw = payload.startsWith('v1:') ? payload.slice(3) : payload;
    const buf = Buffer.from(raw, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
