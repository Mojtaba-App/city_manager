import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'support_packages' })
export class SupportPackage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 30, default: 'other' })
  category!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'budget_amount', nullable: true })
  budgetAmount?: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

@Entity({ schema: 'case', name: 'household_support_assignments' })
export class HouseholdSupportAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'uuid', name: 'package_id' })
  packageId!: string;

  @Column({ type: 'varchar', length: 20, default: 'planned' })
  status!: string;

  @Column({ type: 'date', name: 'assigned_at' })
  assignedAt!: string;

  @Column({ type: 'date', name: 'started_at', nullable: true })
  startedAt?: string;

  @Column({ type: 'date', name: 'completed_at', nullable: true })
  completedAt?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  amount?: string;

  @Column({ type: 'text', name: 'outcome_notes', nullable: true })
  outcomeNotes?: string;

  @Column({ type: 'uuid', name: 'assigned_by', nullable: true })
  assignedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
