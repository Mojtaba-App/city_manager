import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'integration', name: 'sync_jobs' })
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'connector_id' })
  connectorId!: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string;

  @Column({ type: 'varchar', length: 50, name: 'trigger_type', default: 'manual' })
  triggerType!: string;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt?: Date;

  @Column({ type: 'int', name: 'records_read', default: 0 })
  recordsRead!: number;

  @Column({ type: 'int', name: 'records_written', default: 0 })
  recordsWritten!: number;

  @Column({ type: 'int', name: 'records_failed', default: 0 })
  recordsFailed!: number;

  @Column({ type: 'int', default: 1 })
  attempt!: number;

  @Column({ type: 'text', name: 'error_summary', nullable: true })
  errorSummary?: string;

  @Column({ type: 'jsonb', name: 'result_summary', default: {} })
  resultSummary!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'triggered_by', nullable: true })
  triggeredBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
