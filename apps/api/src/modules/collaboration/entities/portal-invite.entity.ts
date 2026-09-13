import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'portal_invites' })
export class PortalInvite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'varchar', length: 128, name: 'invite_code_hash' })
  inviteCodeHash!: string;

  @Column({ type: 'varchar', length: 12, name: 'invite_code_hint' })
  inviteCodeHint!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ type: 'varchar', length: 200, name: 'recipient_name', nullable: true })
  recipientName?: string;

  @Column({ type: 'varchar', length: 20, name: 'recipient_phone', nullable: true })
  recipientPhone?: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'activated_at', nullable: true })
  activatedAt?: Date;

  @Column({ type: 'timestamptz', name: 'last_access_at', nullable: true })
  lastAccessAt?: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
