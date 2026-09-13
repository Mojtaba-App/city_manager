import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'field_visits' })
export class FieldVisit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'uuid', name: 'task_id', nullable: true })
  taskId?: string;

  @Column({ type: 'uuid', name: 'assigned_user_id', nullable: true })
  assignedUserId?: string;

  @Column({ type: 'timestamptz', name: 'scheduled_at' })
  scheduledAt!: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status!: string;

  @Column({ type: 'text', name: 'address_note', nullable: true })
  addressNote?: string;

  @Column({ type: 'text', nullable: true })
  findings?: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude?: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude?: string;

  @Column({ type: 'jsonb', name: 'photo_document_ids', default: [] })
  photoDocumentIds!: string[];

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
