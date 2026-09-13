import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'agency_referrals' })
export class AgencyReferral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'uuid', name: 'agency_id', nullable: true })
  agencyId?: string;

  @Column({ type: 'varchar', length: 40, name: 'destination_kind', default: 'partner_agency' })
  destinationKind!: string;

  @Column({ type: 'smallint', name: 'municipal_district', nullable: true })
  municipalDistrict?: number;

  @Column({ type: 'varchar', length: 80, name: 'destination_code', nullable: true })
  destinationCode?: string;

  @Column({ type: 'varchar', length: 200, name: 'destination_label', nullable: true })
  destinationLabel?: string;

  /** Future: linked partner organization that can inbox this referral */
  @Column({ type: 'uuid', name: 'audience_organization_id', nullable: true })
  audienceOrganizationId?: string;

  /** When true, audience org/district users may view & act (after access is provisioned) */
  @Column({ type: 'boolean', name: 'access_enabled', default: false })
  accessEnabled!: boolean;

  @Column({ type: 'uuid', name: 'consent_id', nullable: true })
  consentId?: string;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status!: string;

  @Column({ type: 'varchar', length: 50, default: 'agency_referral' })
  purpose!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', name: 'scope_fields', default: [] })
  scopeFields!: string[];

  @Column({ type: 'jsonb', name: 'payload_snapshot', nullable: true })
  payloadSnapshot?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 200, name: 'external_reference', nullable: true })
  externalReference?: string;

  @Column({ type: 'uuid', name: 'connector_id', nullable: true })
  connectorId?: string;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamptz', name: 'responded_at', nullable: true })
  respondedAt?: Date;

  @Column({ type: 'text', name: 'response_notes', nullable: true })
  responseNotes?: string;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
