import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, IsNull } from 'typeorm';
import { MessageOutbox } from '../entities/household-document.entity';
import { MessageOutboxStatus } from '@city-manager/shared';
import { MessagingDispatchService } from './messaging-dispatch.service';

@Injectable()
export class MessageOutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MessageOutboxWorkerService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;
  private readonly disableInProcess: boolean;

  constructor(
    @InjectRepository(MessageOutbox)
    private readonly outboxRepo: Repository<MessageOutbox>,
    private readonly messaging: MessagingDispatchService,
    config: ConfigService,
  ) {
    this.disableInProcess = config.get<string>('DISABLE_IN_PROCESS_MESSAGING', 'false') === 'true';
  }

  onModuleInit() {
    if (this.disableInProcess) {
      this.log.log('In-process message outbox worker disabled (DISABLE_IN_PROCESS_MESSAGING=true)');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(limit = 20) {
    if (this.processing) return { processed: 0 };
    this.processing = true;
    let processed = 0;
    try {
      const due = await this.outboxRepo.find({
        where: [
          {
            status: In([MessageOutboxStatus.PENDING, MessageOutboxStatus.FAILED]),
            nextAttemptAt: IsNull(),
          },
          {
            status: In([MessageOutboxStatus.PENDING, MessageOutboxStatus.FAILED]),
            nextAttemptAt: LessThanOrEqual(new Date()),
          },
        ],
        order: { createdAt: 'ASC' },
        take: limit,
      });
      for (const row of due) {
        if (row.attempt >= row.maxAttempts) {
          row.status = MessageOutboxStatus.FAILED;
          row.errorMessage = row.errorMessage ?? 'حداکثر تلاش ارسال به اتمام رسید';
          await this.outboxRepo.save(row);
          continue;
        }
        await this.messaging.processOutboxItem(row.id);
        processed += 1;
      }
    } catch (e) {
      this.log.warn(`Message outbox tick failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.processing = false;
    }
    return { processed };
  }
}
