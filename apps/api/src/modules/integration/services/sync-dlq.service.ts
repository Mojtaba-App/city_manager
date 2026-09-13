import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncDeadLetter } from '../entities/sync-dead-letter.entity';
import { SyncQueueItem } from '../entities/sync-queue-item.entity';
import { QueueItemStatus } from '@city-manager/shared';

@Injectable()
export class SyncDlqService {
  constructor(
    @InjectRepository(SyncDeadLetter) private readonly dlqRepo: Repository<SyncDeadLetter>,
    @InjectRepository(SyncQueueItem) private readonly queueRepo: Repository<SyncQueueItem>,
  ) {}

  async push(input: {
    organizationId: string;
    connectorId: string;
    syncJobId?: string;
    entityType: string;
    externalId?: string;
    payload: Record<string, unknown>;
    errorMessage: string;
    attempt?: number;
  }) {
    return this.dlqRepo.save(
      this.dlqRepo.create({
        organizationId: input.organizationId,
        connectorId: input.connectorId,
        syncJobId: input.syncJobId,
        entityType: input.entityType,
        externalId: input.externalId,
        payload: input.payload,
        errorMessage: input.errorMessage,
        attempt: input.attempt ?? 1,
        status: 'dead',
      }),
    );
  }

  async list(orgId: string, limit = 50) {
    const data = await this.dlqRepo.find({
      where: { organizationId: orgId, status: 'dead' },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { success: true, data };
  }

  async requeue(orgId: string, id: string, userId?: string) {
    const row = await this.dlqRepo.findOne({ where: { id, organizationId: orgId } });
    if (!row) return { success: false, error: { code: 'NOT_FOUND', message: 'آیتم DLQ یافت نشد' } };

    await this.queueRepo.save(
      this.queueRepo.create({
        organizationId: orgId,
        connectorId: row.connectorId,
        syncJobId: row.syncJobId,
        queueType: 'dlq_retry',
        status: QueueItemStatus.PENDING,
        attempt: 0,
        maxAttempts: 3,
        nextAttemptAt: new Date(),
        payload: {
          triggeredBy: userId,
          dlqId: row.id,
          records: [row.payload],
        },
      }),
    );
    row.status = 'requeued';
    row.requeuedAt = new Date();
    await this.dlqRepo.save(row);
    return { success: true, data: row };
  }

  async listQueueDead(orgId: string, limit = 50) {
    const data = await this.queueRepo.find({
      where: { organizationId: orgId, status: QueueItemStatus.DEAD },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { success: true, data };
  }
}
