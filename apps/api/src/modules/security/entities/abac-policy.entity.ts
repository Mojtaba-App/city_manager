import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ schema: 'security', name: 'abac_policies' })
export class AbacPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id', nullable: true })
  @Index()
  organizationId?: string | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 10, default: 'allow' })
  effect!: 'allow' | 'deny';

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ type: 'varchar', length: 100, name: 'resource_type' })
  resourceType!: string;

  @Column({ type: 'jsonb', default: [] })
  actions!: string[];

  @Column({ type: 'jsonb', default: {} })
  condition!: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
