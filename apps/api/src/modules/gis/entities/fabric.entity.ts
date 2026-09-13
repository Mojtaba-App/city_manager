import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'gis', name: 'fabrics' })
export class Fabric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'neighborhood_id', nullable: true })
  neighborhoodId?: string;

  @Column({ type: 'uuid', name: 'fabric_type_id' })
  fabricTypeId!: string;

  @Column({ type: 'uuid', name: 'layer_version_id', nullable: true })
  layerVersionId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  code?: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  name?: string;

  @Column({ type: 'numeric', name: 'area_sqm', nullable: true })
  areaSqm?: number;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
