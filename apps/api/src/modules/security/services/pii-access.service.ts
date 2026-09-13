import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { DataAccessLog, ExportLog, PiiAccessGrant } from '../entities/pii-governance.entity';
import { PiiCryptoService } from '../../case/services/pii-crypto.service';
import { ApiResponse, JwtPayload, Permission, PiiAccessPurpose } from '@city-manager/shared';

export interface LogPiiAccessInput {
  organizationId: string;
  userId: string;
  resourceType: string;
  resourceId?: string;
  fieldName?: string;
  purpose: string;
  reason?: string;
  ipAddress?: string;
}

export interface CreateGrantInput {
  resourceType: string;
  resourceId?: string;
  fields?: string[];
  purpose: string;
  reason?: string;
  expiresInHours?: number;
}

@Injectable()
export class PiiAccessService {
  constructor(
    @InjectRepository(DataAccessLog) private readonly accessRepo: Repository<DataAccessLog>,
    @InjectRepository(ExportLog) private readonly exportRepo: Repository<ExportLog>,
    @InjectRepository(PiiAccessGrant) private readonly grantRepo: Repository<PiiAccessGrant>,
    private readonly pii: PiiCryptoService,
  ) {}

  hashNationalId(value: string): string {
    return this.pii.hash(value);
  }

  canReadPii(user: JwtPayload, field: 'nationalId' | 'phone' = 'nationalId'): boolean {
    const perm = field === 'phone' ? Permission.MEMBERS_READ_PII : Permission.MEMBERS_READ_PII;
    return user.permissions.includes(perm);
  }

  async hasActiveGrant(
    orgId: string,
    userId: string,
    resourceType: string,
    resourceId?: string,
    field?: string,
  ): Promise<boolean> {
    const grants = await this.grantRepo.find({
      where: {
        organizationId: orgId,
        userId,
        resourceType,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    return grants.some((g) => {
      if (resourceId && g.resourceId && g.resourceId !== resourceId) return false;
      if (field && g.fields.length && !g.fields.includes(field)) return false;
      return true;
    });
  }

  async logAccess(input: LogPiiAccessInput): Promise<void> {
    await this.accessRepo.save(this.accessRepo.create(input));
  }

  async logExport(
    orgId: string,
    userId: string,
    exportType: string,
    rowCount: number,
    reason?: string,
    resourceRef?: string,
  ): Promise<void> {
    await this.exportRepo.save(this.exportRepo.create({
      organizationId: orgId,
      userId,
      exportType,
      rowCount,
      accessReason: reason,
      resourceRef,
    }));
  }

  async createGrant(
    orgId: string,
    userId: string,
    grantedBy: string,
    dto: CreateGrantInput,
  ): Promise<ApiResponse<PiiAccessGrant>> {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('ذکر دلیل دسترسی الزامی است');
    }
    const hours = dto.expiresInHours ?? 24;
    const row = this.grantRepo.create({
      organizationId: orgId,
      userId,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      fields: dto.fields ?? ['nationalId', 'phone'],
      purpose: dto.purpose || PiiAccessPurpose.CASE_REVIEW,
      reason: dto.reason.trim(),
      grantedBy,
      expiresAt: new Date(Date.now() + hours * 3600 * 1000),
    });
    return { success: true, data: await this.grantRepo.save(row) };
  }

  async listAccessLogs(orgId: string, limit = 50): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    const rows = await this.accessRepo.query(
      `SELECT l.*, u.first_name, u.last_name
       FROM audit.data_access_logs l
       LEFT JOIN core.users u ON u.id = l.user_id
       WHERE l.organization_id = $1
       ORDER BY l.created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return { success: true, data: rows };
  }

  async listExportLogs(orgId: string, limit = 50): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    const rows = await this.exportRepo.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { success: true, data: rows as unknown as Array<Record<string, unknown>> };
  }
}
