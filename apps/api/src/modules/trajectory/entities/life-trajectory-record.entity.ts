import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'trajectory', name: 'life_trajectory_records' })
export class LifeTrajectoryRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'uuid', name: 'member_id', nullable: true })
  memberId?: string;

  @Column({ type: 'varchar', length: 50, name: 'record_type' })
  recordType!: string;

  @Column({ type: 'date', name: 'period_start', nullable: true })
  periodStart?: string;

  @Column({ type: 'date', name: 'period_end', nullable: true })
  periodEnd?: string;

  @Column({ type: 'varchar', length: 50, name: 'event_type', nullable: true })
  eventType?: string;

  @Column({ type: 'date', name: 'event_date' })
  eventDate!: string;

  @Column({ type: 'varchar', length: 50, name: 'employment_status', nullable: true })
  employmentStatus?: string;

  @Column({ type: 'varchar', length: 200, name: 'job_title', nullable: true })
  jobTitle?: string;

  @Column({ type: 'varchar', length: 300, name: 'employer_name', nullable: true })
  employerName?: string;

  @Column({ type: 'varchar', length: 200, name: 'previous_job_title', nullable: true })
  previousJobTitle?: string;

  @Column({ type: 'numeric', name: 'monthly_income', nullable: true })
  monthlyIncome?: number;

  @Column({ type: 'numeric', name: 'previous_income', nullable: true })
  previousIncome?: number;

  @Column({ type: 'varchar', length: 3, name: 'income_currency', default: 'IRR' })
  incomeCurrency!: string;

  @Column({ type: 'varchar', length: 50, name: 'education_level', nullable: true })
  educationLevel?: string;

  @Column({ type: 'varchar', length: 200, name: 'education_field', nullable: true })
  educationField?: string;

  @Column({ type: 'uuid', name: 'dwelling_id', nullable: true })
  dwellingId?: string;

  @Column({ type: 'uuid', name: 'previous_dwelling_id', nullable: true })
  previousDwellingId?: string;

  @Column({ type: 'text', name: 'dwelling_address', nullable: true })
  dwellingAddress?: string;

  @Column({ type: 'text', name: 'previous_dwelling_address', nullable: true })
  previousDwellingAddress?: string;

  @Column({ type: 'smallint', name: 'quality_of_life_score', nullable: true })
  qualityOfLifeScore?: number;

  @Column({ type: 'smallint', name: 'previous_qol_score', nullable: true })
  previousQolScore?: number;

  @Column({ type: 'jsonb', name: 'qol_dimensions', default: {} })
  qolDimensions!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, name: 'support_status', nullable: true })
  supportStatus?: string;

  @Column({ type: 'varchar', length: 50, name: 'previous_support_status', nullable: true })
  previousSupportStatus?: string;

  @Column({ type: 'uuid', name: 'support_agency_id', nullable: true })
  supportAgencyId?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, default: 'manual' })
  source!: string;

  @Column({ type: 'uuid', name: 'recorded_by', nullable: true })
  recordedBy?: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
