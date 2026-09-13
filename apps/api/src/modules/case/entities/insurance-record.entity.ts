import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'insurance_records' })
export class InsuranceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'uuid', name: 'member_id', nullable: true })
  memberId?: string;

  @Column({ type: 'uuid', name: 'agency_id', nullable: true })
  agencyId?: string;

  @Column({ type: 'varchar', length: 100, name: 'insurance_type' })
  insuranceType!: string;

  @Column({ type: 'text', name: 'policy_number_enc', nullable: true })
  policyNumberEnc?: string;

  @Column({ type: 'date', name: 'coverage_start', nullable: true })
  coverageStart?: string;

  @Column({ type: 'date', name: 'coverage_end', nullable: true })
  coverageEnd?: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
