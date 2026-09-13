import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'integration', name: 'sync_dead_letters' })
export class SyncDeadLetter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'connector_id' })
  connectorId!: string;

  @Column({ type: 'uuid', name: 'sync_job_id', nullable: true })
  syncJobId?: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_type', default: 'custom' })
  entityType!: string;

  @Column({ type: 'varchar', length: 500, name: 'external_id', nullable: true })
  externalId?: string;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({ type: 'text', name: 'error_message' })
  errorMessage!: string;

  @Column({ type: 'int', default: 1 })
  attempt!: number;

  @Column({ type: 'varchar', length: 30, default: 'dead' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', name: 'requeued_at', nullable: true })
  requeuedAt?: Date;
}
