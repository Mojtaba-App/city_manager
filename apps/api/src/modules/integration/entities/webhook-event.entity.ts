import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'integration', name: 'webhook_events' })
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'connector_id' })
  connectorId!: string;

  @Column({ type: 'varchar', length: 100, name: 'event_type', nullable: true })
  eventType?: string;

  @Column({ type: 'boolean', name: 'signature_valid', nullable: true })
  signatureValid?: boolean;

  @Column({ type: 'jsonb', default: {} })
  headers!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, name: 'processing_status', default: 'received' })
  processingStatus!: string;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ type: 'uuid', name: 'sync_job_id', nullable: true })
  syncJobId?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'received_at' })
  receivedAt!: Date;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  processedAt?: Date;
}
