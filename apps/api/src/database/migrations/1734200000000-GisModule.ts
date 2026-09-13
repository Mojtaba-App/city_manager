import { MigrationInterface, QueryRunner } from 'typeorm';

export class GisModule1734200000000 implements MigrationInterface {
  name = 'GisModule1734200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS program`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS gis`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "case"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE program.neighborhood_status_enum AS ENUM (
          'planned', 'active', 'paused', 'completed', 'archived'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE gis.layer_status_enum AS ENUM (
          'draft', 'review', 'published', 'archived'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE gis.geometry_type_enum AS ENUM (
          'point', 'linestring', 'polygon', 'multipolygon'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program.regeneration_programs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        code VARCHAR(100) NOT NULL,
        name VARCHAR(300) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program.neighborhoods (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        program_id UUID NOT NULL REFERENCES program.regeneration_programs(id),
        code VARCHAR(100) NOT NULL,
        name VARCHAR(300) NOT NULL,
        status program.neighborhood_status_enum NOT NULL DEFAULT 'planned',
        boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,
        centroid GEOMETRY(Point, 4326),
        area_sqm NUMERIC(14, 2),
        priority_rank SMALLINT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE (organization_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gis.fabric_types (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        code VARCHAR(100) NOT NULL,
        name VARCHAR(200) NOT NULL,
        color_hex VARCHAR(7) NOT NULL DEFAULT '#1a5276',
        fill_opacity NUMERIC(3, 2) NOT NULL DEFAULT 0.35,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gis.gis_layers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        code VARCHAR(100) NOT NULL,
        name VARCHAR(300) NOT NULL,
        description TEXT,
        geometry_type gis.geometry_type_enum NOT NULL DEFAULT 'multipolygon',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gis.layer_versions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        layer_id UUID NOT NULL REFERENCES gis.gis_layers(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        status gis.layer_status_enum NOT NULL DEFAULT 'draft',
        published_at TIMESTAMPTZ,
        published_by UUID REFERENCES core.users(id),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (layer_id, version_number)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gis.fabrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        neighborhood_id UUID REFERENCES program.neighborhoods(id),
        fabric_type_id UUID NOT NULL REFERENCES gis.fabric_types(id),
        layer_version_id UUID REFERENCES gis.layer_versions(id),
        code VARCHAR(100),
        name VARCHAR(300),
        geometry GEOMETRY(MultiPolygon, 4326) NOT NULL,
        area_sqm NUMERIC(14, 2),
        attributes JSONB,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".dwellings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        neighborhood_id UUID REFERENCES program.neighborhoods(id),
        dwelling_code VARCHAR(100),
        title VARCHAR(300),
        full_address TEXT,
        location GEOMETRY(Point, 4326),
        building_type VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gis.spatial_uploads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        uploaded_by UUID REFERENCES core.users(id),
        original_filename VARCHAR(500) NOT NULL,
        file_format VARCHAR(50) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        features_imported INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'completed',
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_neighborhoods_boundary_gist
        ON program.neighborhoods USING GIST (boundary)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fabrics_geometry_gist
        ON gis.fabrics USING GIST (geometry)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dwellings_location_gist
        ON "case".dwellings USING GIST (location)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_neighborhoods_org
        ON program.neighborhoods(organization_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fabrics_org
        ON gis.fabrics(organization_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dwellings_org
        ON "case".dwellings(organization_id) WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS gis.spatial_uploads`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".dwellings`);
    await queryRunner.query(`DROP TABLE IF EXISTS gis.fabrics`);
    await queryRunner.query(`DROP TABLE IF EXISTS gis.layer_versions`);
    await queryRunner.query(`DROP TABLE IF EXISTS gis.gis_layers`);
    await queryRunner.query(`DROP TABLE IF EXISTS gis.fabric_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS program.neighborhoods`);
    await queryRunner.query(`DROP TABLE IF EXISTS program.regeneration_programs`);
  }
}
