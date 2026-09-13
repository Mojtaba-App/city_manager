import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'case', name: 'household_status_history' })
export class HouseholdStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'varchar', length: 50, name: 'from_status', nullable: true })
  fromStatus?: string;

  @Column({ type: 'varchar', length: 50, name: 'to_status' })
  toStatus!: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'uuid', name: 'changed_by', nullable: true })
  changedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'changed_at' })
  changedAt!: Date;
}
