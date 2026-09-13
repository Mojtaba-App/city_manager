import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'trajectory', name: 'expert_notes' })
export class ExpertNote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'uuid', name: 'member_id', nullable: true })
  memberId?: string;

  @Column({ type: 'uuid', name: 'record_id', nullable: true })
  recordId?: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  title?: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 50, name: 'note_type', default: 'assessment' })
  noteType!: string;

  @Column({ type: 'boolean', name: 'is_confidential', default: false })
  isConfidential!: boolean;

  @Column({ type: 'uuid', name: 'author_id', nullable: true })
  authorId?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
