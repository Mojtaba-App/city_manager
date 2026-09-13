import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationController } from './integration.controller';
import { Connector } from './entities/connector.entity';
import { FieldMapping } from './entities/field-mapping.entity';
import { SyncJob } from './entities/sync-job.entity';
import { SyncJobLog } from './entities/sync-job-log.entity';
import { SyncQueueItem } from './entities/sync-queue-item.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { ExternalIdMapping } from './entities/external-id-mapping.entity';
import { ConnectionTest } from './entities/connection-test.entity';
import { SyncDeadLetter } from './entities/sync-dead-letter.entity';
import { Household } from '../case/entities/household.entity';
import { FamilyMember } from '../case/entities/family-member.entity';
import { Dwelling } from '../case/entities/dwelling.entity';
import { SecretsCryptoService } from './services/secrets-crypto.service';
import { ConnectorsService } from './services/connectors.service';
import { ConnectionTestService } from './services/connection-test.service';
import { SyncRunnerService } from './services/sync-runner.service';
import { SyncQueueService } from './services/sync-queue.service';
import { SyncEntityWriterService } from './services/sync-entity-writer.service';
import { SyncDlqService } from './services/sync-dlq.service';
import { WebhookService } from './services/webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Connector, FieldMapping, SyncJob, SyncJobLog,
      SyncQueueItem, WebhookEvent, ExternalIdMapping, ConnectionTest,
      SyncDeadLetter, Household, FamilyMember, Dwelling,
    ]),
  ],
  controllers: [IntegrationController],
  providers: [
    SecretsCryptoService,
    ConnectorsService,
    ConnectionTestService,
    SyncEntityWriterService,
    SyncDlqService,
    SyncRunnerService,
    SyncQueueService,
    WebhookService,
  ],
  exports: [ConnectorsService, SyncRunnerService, SyncQueueService],
})
export class IntegrationModule {}
