import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ schema: 'program', name: 'area_projects' })
export class AreaProject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 20, name: 'target_type' })
  targetType!: string;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'varchar', length: 30, name: 'project_kind', default: 'executive' })
  projectKind!: string;

  @Column({ type: 'varchar', length: 30, name: 'party_role', nullable: true })
  partyRole?: string;

  @Column({ type: 'varchar', length: 300, name: 'party_name', nullable: true })
  partyName?: string;

  @Column({ type: 'numeric', precision: 18, scale: 0, nullable: true })
  amount?: string;

  @Column({ type: 'varchar', length: 10, default: 'IRR' })
  currency!: string;

  @Column({ type: 'varchar', length: 30, default: 'planned' })
  status!: string;

  @Column({ type: 'varchar', length: 100, name: 'contract_number', nullable: true })
  contractNumber?: string;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate?: string;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'program_id', nullable: true })
  programId?: string;

  @Column({ type: 'varchar', length: 300, name: 'contractor_name', nullable: true })
  contractorName?: string;

  @Column({ type: 'smallint', name: 'progress_percent', default: 0 })
  progressPercent!: number;

  @Column({ type: 'numeric', precision: 18, scale: 0, name: 'budget_spent', nullable: true })
  budgetSpent?: string;

  @Column({ type: 'int', name: 'households_affected', default: 0 })
  householdsAffected!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
