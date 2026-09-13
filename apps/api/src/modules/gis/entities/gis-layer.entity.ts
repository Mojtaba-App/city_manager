import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UrbanLayerCategory } from '@city-manager/shared';

export enum LayerStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum GeometryType {
  POINT = 'point',
  LINESTRING = 'linestring',
  POLYGON = 'polygon',
  MULTIPOLYGON = 'multipolygon',
}

@Entity({ schema: 'gis', name: 'gis_layers' })
export class GisLayer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
    length: 40,
    default: UrbanLayerCategory.CUSTOM,
  })
  category!: UrbanLayerCategory;

  @Column({ type: 'enum', enum: GeometryType, name: 'geometry_type', default: GeometryType.MULTIPOLYGON })
  geometryType!: GeometryType;

  @Column({ type: 'varchar', length: 7, name: 'color_hex', default: '#2e86ab' })
  colorHex!: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, name: 'fill_opacity', default: 0.25 })
  fillOpacity!: number;

  @Column({ type: 'varchar', length: 7, name: 'stroke_hex', default: '#1b4f72' })
  strokeHex!: string;

  @Column({ type: 'decimal', precision: 4, scale: 2, name: 'stroke_width', default: 2.5 })
  strokeWidth!: number;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

@Entity({ schema: 'gis', name: 'layer_versions' })
export class LayerVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'layer_id' })
  layerId!: string;

  @Column({ type: 'int', name: 'version_number' })
  versionNumber!: number;

  @Column({ type: 'enum', enum: LayerStatus, default: LayerStatus.DRAFT })
  status!: LayerStatus;

  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  publishedAt?: Date;

  @Column({ type: 'uuid', name: 'published_by', nullable: true })
  publishedBy?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

@Entity({ schema: 'gis', name: 'layer_features' })
export class LayerFeature {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'layer_id' })
  layerId!: string;

  @Column({ type: 'uuid', name: 'layer_version_id' })
  layerVersionId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  code?: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  name?: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
  })
  geometry!: object;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'area_sqm', nullable: true })
  areaSqm?: number;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
