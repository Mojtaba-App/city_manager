import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'dwellings' })
export class Dwelling {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'neighborhood_id', nullable: true })
  neighborhoodId?: string;

  @Column({ type: 'varchar', length: 100, name: 'dwelling_code', nullable: true })
  dwellingCode?: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  title?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district?: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  street?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  alley?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  plaque?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string;

  @Column({ type: 'varchar', length: 20, name: 'postal_code', nullable: true })
  postalCode?: string;

  @Column({ type: 'text', name: 'full_address', nullable: true })
  fullAddress?: string;

  @Column({ type: 'numeric', name: 'area_sqm', nullable: true })
  areaSqm?: number;

  @Column({ type: 'varchar', length: 100, name: 'building_type', nullable: true })
  buildingType?: string;

  @Column({ type: 'varchar', length: 40, name: 'land_use', nullable: true })
  landUse?: string;

  @Column({ type: 'smallint', name: 'floor_count', nullable: true })
  floorCount?: number;

  @Column({ type: 'smallint', name: 'unit_count', nullable: true })
  unitCount?: number;

  @Column({ type: 'smallint', name: 'construction_year', nullable: true })
  constructionYear?: number;

  @Column({ type: 'smallint', name: 'building_age_years', nullable: true })
  buildingAgeYears?: number;

  @Column({ type: 'jsonb', name: 'custom_fields', default: {} })
  customFields!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'case' })
  source!: string;

  @Column({ type: 'timestamptz', name: 'synced_at', nullable: true })
  syncedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
