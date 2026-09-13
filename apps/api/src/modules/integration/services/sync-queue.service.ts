import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { SyncQueueItem } from '../entities/sync-queue-item.entity';
import { Connector } from '../entities/connector.entity';
import { DEFAULT_RETRY_POLICY, QueueItemStatus, RetryPolicy } from '@city-manager/shared';
import { SyncRunnerService } from './sync-runner.service';

export interface SyncQueueMetrics {
  processedTotal: number;
  failedTotal: number;
  lastTickAt?: string;
  pendingCount: number;
  inProcessSyncDisabled: boolean;
}

@Injectable()
export class SyncQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncQueueService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;
  private processedTotal = 0;
  private failedTotal = 0;
  private lastTickAt?: Date;
  private readonly disableInProcess: boolean;

  constructor(
    @InjectRepository(SyncQueueItem) private readonly queueRepo: Repository<SyncQueueItem>,
    @InjectRepository(Connector) private readonly connectorRepo: Repository<Connector>,
    private readonly runner: SyncRunnerService,
    config: ConfigService,
  ) {
    this.disableInProcess = config.get<string>('DISABLE_IN_PROCESS_SYNC', 'false') === 'true';
  }

  onModuleInit() {
    if (this.disableInProcess) {
      this.logger.log('In-process sync worker disabled (DISABLE_IN_PROCESS_SYNC=true)');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(
    orgId: string,
    connectorId: string,
    syncJobId: string | undefined,
    payload: Record<string, unknown>,
    maxAttempts = DEFAULT_RETRY_POLICY.maxAttempts,
  ) {
    const item = await this.queueRepo.save(
      this.queueRepo.create({
        organizationId: orgId,
        connectorId,
        syncJobId,
        queueType: 'sync',
        status: QueueItemStatus.PENDING,
        attempt: 0,
        maxAttempts,
        nextAttemptAt: new Date(),
        payload,
      }),
    );
    return item;
  }

  async list(orgId: string, limit = 50) {
    const data = await this.queueRepo.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { success: true, data };
  }

  async getMetrics(orgId?: string): Promise<SyncQueueMetrics> {
    const where = orgId
      ? {
          organizationId: orgId,
          status: In([QueueItemStatus.PENDING, QueueItemStatus.FAILED, QueueItemStatus.PROCESSING]),
        }
      : {
          status: In([QueueItemStatus.PENDING, QueueItemStatus.FAILED, QueueItemStatus.PROCESSING]),
        };
    const pendingCount = await this.queueRepo.count({ where });
    return {
      processedTotal: this.processedTotal,
      failedTotal: this.failedTotal,
      lastTickAt: this.lastTickAt?.toISOString(),
      pendingCount,
      inProcessSyncDisabled: this.disableInProcess,
    };
  }

  async tick() {
    if (this.processing) return;
    this.processing = true;
    this.lastTickAt = new Date();
    try {
      await this.processDueConnectors();
      await this.processQueue();
    } catch (e) {
      this.logger.warn(`Queue tick failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.processing = false;
    }
  }

  private async processDueConnectors() {
    const due = await this.connectorRepo.find({
      where: {
        isActive: true,
        nextRunAt: LessThanOrEqual(new Date()),
      },
      take: 5,
    });
    for (const c of due) {
      if (!c.scheduleIntervalMinutes) continue;
      try {
        await this.runner.run(c.organizationId, c.id, undefined, 'schedule');
        this.processedTotal += 1;
      } catch (e) {
        this.failedTotal += 1;
        this.logger.warn(`Scheduled sync failed for ${c.code}: ${e instanceof Error ? e.message : e}`);
      }
      c.nextRunAt = new Date(Date.now() + c.scheduleIntervalMinutes * 60_000);
      await this.connectorRepo.save(c);
    }
  }

  private resolveRetryPolicy(connector?: Connector | null): RetryPolicy {
    const raw = (connector?.connectionConfig?.retry ?? {}) as Partial<RetryPolicy>;
    return {
      ...DEFAULT_RETRY_POLICY,
      ...raw,
      maxAttempts: Number(raw.maxAttempts) || DEFAULT_RETRY_POLICY.maxAttempts,
      backoffMs: Number(raw.backoffMs) || DEFAULT_RETRY_POLICY.backoffMs,
      backoffMultiplier: Number(raw.backoffMultiplier) || DEFAULT_RETRY_POLICY.backoffMultiplier,
      maxBackoffMs: Number(raw.maxBackoffMs) || DEFAULT_RETRY_POLICY.maxBackoffMs,
    };
  }

  private async processQueue() {
    const items = await this.queueRepo.find({
      where: {
        status: In([QueueItemStatus.PENDING, QueueItemStatus.FAILED]),
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
      order: { nextAttemptAt: 'ASC' },
      take: 5,
    });

    for (const item of items) {
      if (item.attempt >= item.maxAttempts) {
        item.status = QueueItemStatus.DEAD;
        item.lastError = item.lastError ?? 'حداکثر تلاش به اتمام رسید';
        await this.queueRepo.save(item);
        continue;
      }

      item.status = QueueItemStatus.PROCESSING;
      item.attempt += 1;
      await this.queueRepo.save(item);

      const connector = await this.connectorRepo.findOne({ where: { id: item.connectorId } });
      const retry = this.resolveRetryPolicy(connector);

      try {
        const records = item.payload?.records;
        if (Array.isArray(records) && records.length) {
          await this.runner.runWithRecords(
            item.organizationId,
            item.connectorId,
            records as Record<string, unknown>[],
            item.payload?.triggeredBy as string | undefined,
            'retry',
          );
        } else {
          await this.runner.run(
            item.organizationId,
            item.connectorId,
            item.payload?.triggeredBy as string | undefined,
            'retry',
            item.syncJobId,
          );
        }
        item.status = QueueItemStatus.SUCCEEDED;
        item.lastError = undefined;
        await this.queueRepo.save(item);
        this.processedTotal += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'خطای صف';
        item.lastError = msg;
        this.failedTotal += 1;
        const backoff = Math.min(
          retry.maxBackoffMs ?? 60_000,
          retry.backoffMs * Math.pow(retry.backoffMultiplier, item.attempt - 1),
        );
        if (item.attempt >= item.maxAttempts) {
          item.status = QueueItemStatus.DEAD;
        } else {
          item.status = QueueItemStatus.FAILED;
          item.nextAttemptAt = new Date(Date.now() + backoff);
        }
        await this.queueRepo.save(item);
      }
    }
  }
}
