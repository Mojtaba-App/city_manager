import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'household_documents' })
export class HouseholdDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'varchar', length: 30, default: 'other' })
  category!: string;

  @Column({ type: 'varchar', length: 500, name: 'file_name' })
  fileName!: string;

  @Column({ type: 'varchar', length: 120, name: 'content_type' })
  contentType!: string;

  @Column({ type: 'bigint', name: 'file_size', default: 0 })
  fileSize!: string;

  @Column({ type: 'varchar', length: 800, name: 'storage_key' })
  storageKey!: string;

  @Column({ type: 'uuid', name: 'uploaded_by', nullable: true })
  uploadedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

@Entity({ schema: 'case', name: 'vulnerability_assessments' })
export class VulnerabilityAssessment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'total_score' })
  totalScore!: string;

  @Column({ type: 'varchar', length: 20 })
  level!: string;

  @Column({ type: 'jsonb', default: {} })
  breakdown!: Record<string, number>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', name: 'assessed_by', nullable: true })
  assessedBy?: string;

  @Column({ type: 'timestamptz', name: 'assessed_at', default: () => 'NOW()' })
  assessedAt!: Date;
}

@Entity({ schema: 'case', name: 'message_outbox' })
export class MessageOutbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id', nullable: true })
  householdId?: string;

  @Column({ type: 'varchar', length: 10 })
  channel!: string;

  @Column({ type: 'varchar', length: 300 })
  recipient!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 100, name: 'template_code', nullable: true })
  templateCode?: string;

  @Column({ type: 'varchar', length: 100, name: 'event_type', nullable: true })
  eventType?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  attempt!: number;

  @Column({ type: 'int', name: 'max_attempts', default: 5 })
  maxAttempts!: number;

  @Column({ type: 'timestamptz', name: 'next_attempt_at', nullable: true })
  nextAttemptAt?: Date | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt?: Date;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
