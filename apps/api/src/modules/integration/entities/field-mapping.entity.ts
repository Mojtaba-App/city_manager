import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ schema: 'integration', name: 'field_mappings' })
export class FieldMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'connector_id' })
  connectorId!: string;

  @Column({ type: 'varchar', length: 200, name: 'source_field' })
  sourceField!: string;

  @Column({ type: 'varchar', length: 200, name: 'target_field' })
  targetField!: string;

  @Column({ type: 'jsonb', name: 'transform_rule', default: {} })
  transformRule!: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'is_required', default: false })
  isRequired!: boolean;

  @Column({ type: 'smallint', name: 'sort_order', default: 0 })
  sortOrder!: number;
}
