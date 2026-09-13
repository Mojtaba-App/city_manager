import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'case', name: 'entity_change_logs' })
export class EntityChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({ type: 'uuid', name: 'changed_by', nullable: true })
  changedBy?: string;

  @Column({ type: 'jsonb', name: 'old_values', nullable: true })
  oldValues?: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'new_values', nullable: true })
  newValues?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'changed_at' })
  changedAt!: Date;
}
