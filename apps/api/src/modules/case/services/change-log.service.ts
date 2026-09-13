import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EntityChangeLog } from '../entities/entity-change-log.entity';
import { ApiResponse, CHANGE_FIELD_LABELS, EnrichedChangeLogEntry } from '@city-manager/shared';

@Injectable()
export class ChangeLogService {
  constructor(
    @InjectRepository(EntityChangeLog)
    private readonly repo: Repository<EntityChangeLog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async log(input: {
    organizationId: string;
    entityType: string;
    entityId: string;
    action: string;
    changedBy?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }): Promise<void> {
    await this.repo.save({
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      changedBy: input.changedBy,
      oldValues: this.sanitize(input.oldValues),
      newValues: this.sanitize(input.newValues),
    });
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.repo.find({
      where: { entityType, entityId },
      order: { changedAt: 'DESC' },
      take: 100,
    });
  }

  async findEnrichedByEntity(entityType: string, entityId: string): Promise<ApiResponse<EnrichedChangeLogEntry[]>> {
    const rows = await this.repo.find({
      where: { entityType, entityId },
      order: { changedAt: 'DESC' },
      take: 100,
    });

    const userIds = [...new Set(rows.map((r) => r.changedBy).filter(Boolean))] as string[];
    const nameMap = new Map<string, string>();
    if (userIds.length) {
      const users = await this.dataSource.query(
        `SELECT id, first_name, last_name FROM core.users WHERE id = ANY($1)`,
        [userIds],
      );
      for (const u of users) {
        nameMap.set(u.id, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim());
      }
    }

    const data: EnrichedChangeLogEntry[] = rows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      action: r.action,
      changedAt: r.changedAt.toISOString(),
      changedBy: r.changedBy,
      changedByName: r.changedBy ? nameMap.get(r.changedBy) : undefined,
      fieldChanges: this.diffFields(r.oldValues, r.newValues),
    }));

    return { success: true, data };
  }

  private diffFields(
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
  ): EnrichedChangeLogEntry['fieldChanges'] {
    if (!oldValues && !newValues) return undefined;
    const keys = new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})]);
    const skip = new Set(['id', 'organizationId', 'createdAt', 'updatedAt', 'deletedAt', 'syncedAt']);
    const changes: NonNullable<EnrichedChangeLogEntry['fieldChanges']> = [];

    for (const field of keys) {
      if (skip.has(field)) continue;
      const oldV = oldValues?.[field];
      const newV = newValues?.[field];
      if (JSON.stringify(oldV) === JSON.stringify(newV)) continue;
      changes.push({
        field,
        label: CHANGE_FIELD_LABELS[field] ?? field,
        oldValue: oldV,
        newValue: newV,
      });
    }
    return changes.length ? changes : undefined;
  }

  private sanitize(values?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!values) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k.includes('enc') || k.includes('hash') || k === 'nationalId' || k === 'phone') {
        out[k] = '[REDACTED]';
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
