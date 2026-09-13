import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'integration', name: 'sync_job_logs' })
export class SyncJobLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'sync_job_id' })
  syncJobId!: string;

  @Column({ type: 'varchar', length: 20, name: 'log_level', default: 'info' })
  logLevel!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 200, name: 'record_ref', nullable: true })
  recordRef?: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
