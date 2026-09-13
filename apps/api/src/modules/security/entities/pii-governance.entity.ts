import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'audit', name: 'data_access_logs' })
export class DataAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 50, name: 'resource_type' })
  resourceType!: string;

  @Column({ type: 'uuid', name: 'resource_id', nullable: true })
  resourceId?: string;

  @Column({ type: 'varchar', length: 100, name: 'field_name', nullable: true })
  fieldName?: string;

  @Column({ type: 'varchar', length: 50, name: 'access_purpose' })
  accessPurpose!: string;

  @Column({ type: 'text', name: 'access_reason', nullable: true })
  accessReason?: string;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

@Entity({ schema: 'audit', name: 'export_logs' })
export class ExportLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 50, name: 'export_type' })
  exportType!: string;

  @Column({ type: 'varchar', length: 200, name: 'resource_ref', nullable: true })
  resourceRef?: string;

  @Column({ type: 'text', name: 'access_reason', nullable: true })
  accessReason?: string;

  @Column({ type: 'int', name: 'row_count', default: 0 })
  rowCount!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

@Entity({ schema: 'security', name: 'pii_access_grants' })
export class PiiAccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 50, name: 'resource_type' })
  resourceType!: string;

  @Column({ type: 'uuid', name: 'resource_id', nullable: true })
  resourceId?: string;

  @Column({ type: 'jsonb', default: [] })
  fields!: string[];

  @Column({ type: 'varchar', length: 50 })
  purpose!: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'uuid', name: 'granted_by', nullable: true })
  grantedBy?: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
