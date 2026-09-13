import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { UserRole } from './user-role.entity';

@Entity({ schema: 'core', name: 'roles' })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  @Index({ unique: true })
  code!: string;

  @Column({ type: 'uuid', name: 'organization_id', nullable: true })
  organizationId?: string | null;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', default: [] })
  permissions!: string[];

  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem!: boolean;

  @OneToMany(() => UserRole, (ur) => ur.role)
  userRoles!: UserRole[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
