import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ schema: 'security', name: 'managed_secrets' })
export class ManagedSecret {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId!: string;

  @Column({ type: 'varchar', length: 200 })
  key!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  ciphertext!: string;

  @Column({ type: 'int', name: 'key_version', default: 1 })
  keyVersion!: number;

  @Column({ type: 'timestamptz', name: 'rotated_at', nullable: true })
  rotatedAt?: Date;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
