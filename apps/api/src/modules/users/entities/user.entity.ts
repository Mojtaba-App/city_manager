import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { UserRole } from './user-role.entity';

@Entity({ schema: 'core', name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id', nullable: true })
  @Index()
  organizationId?: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @Column({ type: 'varchar', length: 320 })
  @Index({ unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  username?: string;

  @Column({ type: 'varchar', length: 200, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'text', name: 'avatar_url', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'varchar', length: 150, name: 'job_title', nullable: true })
  jobTitle?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  department?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', name: 'is_email_verified', default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'timestamptz', name: 'last_login_at', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'varchar', length: 45, name: 'last_login_ip', nullable: true })
  lastLoginIp?: string;

  @Column({ type: 'text', name: 'last_login_user_agent', nullable: true })
  lastLoginUserAgent?: string;

  @Column({ type: 'text', name: 'inactive_reason', nullable: true })
  inactiveReason?: string;

  @Column({ type: 'timestamptz', name: 'inactive_at', nullable: true })
  inactiveAt?: Date;

  @Column({ type: 'boolean', name: 'must_change_password', default: false })
  mustChangePassword!: boolean;

  @Column({ type: 'timestamptz', name: 'last_seen_at', nullable: true })
  lastSeenAt?: Date;

  @Column({ type: 'uuid', name: 'inactive_by', nullable: true })
  inactiveBy?: string;

  @OneToMany(() => UserRole, (ur) => ur.user)
  userRoles!: UserRole[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
