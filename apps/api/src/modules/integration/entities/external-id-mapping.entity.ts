import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'integration', name: 'external_id_mappings' })
export class ExternalIdMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'connector_id' })
  connectorId!: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'uuid', name: 'internal_id', nullable: true })
  internalId?: string;

  @Column({ type: 'varchar', length: 500, name: 'external_id' })
  externalId!: string;

  @Column({ type: 'jsonb', name: 'last_payload', nullable: true })
  lastPayload?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'last_synced_at' })
  lastSyncedAt!: Date;
}
