import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditOutcome, AuditSeverity } from '@city-manager/shared';

@Entity({ schema: 'audit', name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  @Index()
  userId?: string;

  @Column({ type: 'uuid', name: 'organization_id', nullable: true })
  @Index()
  organizationId?: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 100 })
  resource!: string;

  @Column({ type: 'varchar', length: 100, name: 'resource_id', nullable: true })
  resourceId?: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 20, default: AuditOutcome.SUCCESS })
  outcome!: AuditOutcome;

  @Column({ type: 'varchar', length: 20, default: AuditSeverity.INFO })
  severity!: AuditSeverity;

  @Column({ type: 'varchar', length: 64, name: 'request_id', nullable: true })
  requestId?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  @Index()
  createdAt!: Date;
}
