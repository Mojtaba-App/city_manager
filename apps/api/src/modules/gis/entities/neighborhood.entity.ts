import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum NeighborhoodStatus {
  NORMAL = 'normal',
  PLANNED = 'planned',
  ACTIVE = 'active',
  JOINT_ACTION = 'joint_action',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity({ schema: 'program', name: 'neighborhoods' })
export class Neighborhood {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'program_id' })
  programId!: string;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'varchar', length: 50, default: 'planned' })
  status!: string;

  @Column({ type: 'smallint', name: 'municipal_district', nullable: true })
  municipalDistrict?: number;

  @Column({ type: 'int', nullable: true })
  population?: number;

  @Column({ type: 'int', name: 'household_count', nullable: true })
  householdCount?: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'avg_income', nullable: true })
  avgIncome?: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'literacy_rate', nullable: true })
  literacyRate?: number;

  @Column({ type: 'numeric', name: 'area_sqm', nullable: true })
  areaSqm?: number;

  @Column({ type: 'smallint', name: 'priority_rank', nullable: true })
  priorityRank?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
