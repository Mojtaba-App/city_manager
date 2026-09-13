import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ schema: 'gis', name: 'spatial_uploads' })
export class SpatialUpload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'uploaded_by', nullable: true })
  uploadedBy?: string;

  @Column({ type: 'varchar', length: 500, name: 'original_filename' })
  originalFilename!: string;

  @Column({ type: 'varchar', length: 50, name: 'file_format' })
  fileFormat!: string;

  @Column({ type: 'varchar', length: 50, name: 'target_type' })
  targetType!: string;

  @Column({ type: 'integer', name: 'features_imported', default: 0 })
  featuresImported!: number;

  @Column({ type: 'varchar', length: 50, default: 'completed' })
  status!: string;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
