import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'integration', name: 'connectors' })
export class Connector {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, name: 'connector_type', default: 'rest_api' })
  connectorType!: string;

  @Column({ type: 'varchar', length: 50, name: 'sync_direction', default: 'inbound' })
  syncDirection!: string;

  @Column({ type: 'varchar', length: 100, name: 'target_entity', default: 'household' })
  targetEntity!: string;

  @Column({ type: 'jsonb', name: 'connection_config', default: {} })
  connectionConfig!: Record<string, unknown>;

  @Column({ type: 'text', name: 'auth_secrets_enc', nullable: true })
  authSecretsEnc?: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 100, name: 'schedule_cron', nullable: true })
  scheduleCron?: string;

  @Column({ type: 'int', name: 'schedule_interval_minutes', nullable: true })
  scheduleIntervalMinutes?: number;

  @Column({ type: 'timestamptz', name: 'next_run_at', nullable: true })
  nextRunAt?: Date;

  @Column({ type: 'timestamptz', name: 'last_sync_at', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'varchar', length: 50, name: 'last_sync_status', nullable: true })
  lastSyncStatus?: string;

  @Column({ type: 'timestamptz', name: 'last_test_at', nullable: true })
  lastTestAt?: Date;

  @Column({ type: 'boolean', name: 'last_test_ok', nullable: true })
  lastTestOk?: boolean;

  @Column({ type: 'text', name: 'last_test_message', nullable: true })
  lastTestMessage?: string;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
