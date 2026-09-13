import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity({ schema: 'analytics', name: 'report_snapshots' })
export class ReportSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'report_id', nullable: true })
  reportId?: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 100, name: 'report_code' })
  reportCode!: string;

  @Column({ type: 'varchar', length: 100, name: 'period_label', nullable: true })
  periodLabel?: string;

  @Column({ type: 'jsonb', default: {} })
  parameters!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'result_data' })
  resultData!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'generated_by', nullable: true })
  generatedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'generated_at' })
  generatedAt!: Date;
}
