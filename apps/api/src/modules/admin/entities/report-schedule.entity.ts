import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'core', name: 'report_schedules' })
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 100, name: 'report_code' })
  reportCode!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'varchar', length: 20, default: 'weekly' })
  frequency!: string;

  @Column({ type: 'jsonb', default: [] })
  recipients!: string[];

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled!: boolean;

  @Column({ type: 'timestamptz', name: 'last_run_at', nullable: true })
  lastRunAt?: Date;

  @Column({ type: 'timestamptz', name: 'next_run_at', nullable: true })
  nextRunAt?: Date;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
