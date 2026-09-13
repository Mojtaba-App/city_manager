import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'case', name: 'ownership_records' })
export class OwnershipRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'dwelling_id' })
  dwellingId!: string;

  @Column({ type: 'uuid', name: 'household_id', nullable: true })
  householdId?: string;

  @Column({ type: 'varchar', length: 50, name: 'ownership_type' })
  ownershipType!: string;

  @Column({ type: 'varchar', length: 300, name: 'owner_name', nullable: true })
  ownerName?: string;

  @Column({ type: 'date', name: 'lease_start_date', nullable: true })
  leaseStartDate?: string;

  @Column({ type: 'date', name: 'lease_end_date', nullable: true })
  leaseEndDate?: string;

  @Column({ type: 'numeric', name: 'monthly_rent', nullable: true })
  monthlyRent?: number;

  @Column({ type: 'varchar', length: 200, name: 'document_reference', nullable: true })
  documentReference?: string;

  @Column({ type: 'boolean', name: 'is_current', default: true })
  isCurrent!: boolean;

  @Column({ type: 'uuid', name: 'recorded_by', nullable: true })
  recordedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'recorded_at' })
  recordedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
