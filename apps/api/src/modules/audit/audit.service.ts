import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import {
  AuditLogDto,
  AuditOutcome,
  AuditQueryParams,
  AuditSeverity,
} from '@city-manager/shared';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditLogInput {
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  outcome?: AuditOutcome;
  severity?: AuditSeverity;
  requestId?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.auditRepo.save({
      ...input,
      outcome: input.outcome ?? AuditOutcome.SUCCESS,
      severity: input.severity ?? AuditSeverity.INFO,
    });
  }

  async query(
    orgId: string | null,
    params: AuditQueryParams,
  ): Promise<{ items: AuditLogDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 30));
    const where: FindOptionsWhere<AuditLog> = {};

    if (orgId) where.organizationId = orgId;
    if (params.action) where.action = params.action;
    if (params.resource) where.resource = params.resource;
    if (params.userId) where.userId = params.userId;
    if (params.outcome) where.outcome = params.outcome;

    if (params.from && params.to) {
      where.createdAt = Between(new Date(params.from), new Date(params.to));
    } else if (params.from) {
      where.createdAt = MoreThanOrEqual(new Date(params.from));
    } else if (params.to) {
      where.createdAt = LessThanOrEqual(new Date(params.to));
    }

    const qb = this.auditRepo.createQueryBuilder('a').where(where);

    if (params.q) {
      qb.andWhere(
        '(a.action ILIKE :q OR a.resource ILIKE :q OR a.resource_id ILIKE :q)',
        { q: `%${params.q}%` },
      );
    }

    qb.orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => this.toDto(r)),
      total,
      page,
      limit,
    };
  }

  async stats(orgId: string | null) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const qb = this.auditRepo.createQueryBuilder('a')
      .where('a.created_at >= :since', { since });
    if (orgId) qb.andWhere('a.organization_id = :orgId', { orgId });

    const last24h = await qb.getCount();

    const deniedQ = this.auditRepo.createQueryBuilder('a')
      .where('a.created_at >= :since', { since })
      .andWhere('a.outcome = :o', { o: AuditOutcome.DENIED });
    if (orgId) deniedQ.andWhere('a.organization_id = :orgId', { orgId });
    const deniedLast24h = await deniedQ.getCount();

    const critQ = this.auditRepo.createQueryBuilder('a')
      .where('a.created_at >= :since', { since })
      .andWhere('a.severity = :s', { s: AuditSeverity.CRITICAL });
    if (orgId) critQ.andWhere('a.organization_id = :orgId', { orgId });
    const criticalLast24h = await critQ.getCount();

    return { last24h, deniedLast24h, criticalLast24h };
  }

  private toDto(r: AuditLog): AuditLogDto {
    return {
      id: r.id,
      userId: r.userId,
      organizationId: r.organizationId,
      action: r.action,
      resource: r.resource,
      resourceId: r.resourceId,
      payload: r.payload,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      outcome: r.outcome,
      severity: r.severity,
      requestId: r.requestId,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
