import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'households' })
export class Household {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'neighborhood_id', nullable: true })
  neighborhoodId?: string;

  @Column({ type: 'uuid', name: 'dwelling_id' })
  dwellingId!: string;

  @Column({ type: 'varchar', length: 100, name: 'case_number' })
  caseNumber!: string;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status!: string;

  @Column({ type: 'date', name: 'registered_at' })
  registeredAt!: string;

  @Column({ type: 'uuid', name: 'head_member_id', nullable: true })
  headMemberId?: string;

  @Column({ type: 'smallint', name: 'member_count', default: 0 })
  memberCount!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', name: 'custom_fields', default: {} })
  customFields!: Record<string, unknown>;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @Column({ type: 'uuid', name: 'assigned_user_id', nullable: true })
  assignedUserId?: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'vulnerability_score', nullable: true })
  vulnerabilityScore?: string;

  @Column({ type: 'varchar', length: 20, name: 'vulnerability_level', nullable: true })
  vulnerabilityLevel?: string;

  @Column({ type: 'int', name: 'priority_rank', nullable: true })
  priorityRank?: number;

  @Column({ type: 'timestamptz', name: 'last_assessment_at', nullable: true })
  lastAssessmentAt?: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
