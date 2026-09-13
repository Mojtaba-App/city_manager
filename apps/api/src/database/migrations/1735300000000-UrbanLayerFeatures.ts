import { MigrationInterface, QueryRunner } from 'typeorm';

export class UrbanLayerFeatures1735300000000 implements MigrationInterface {
  name = 'UrbanLayerFeatures1735300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE gis.urban_layer_category_enum AS ENUM (
          'city_boundary', 'district', 'urban_plan', 'zoning', 'infrastructure', 'custom'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE gis.gis_layers
        ADD COLUMN IF NOT EXISTS category gis.urban_layer_category_enum NOT NULL DEFAULT 'custom',
        ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7) NOT NULL DEFAULT '#2e86ab',
        ADD COLUMN IF NOT EXISTS fill_opacity NUMERIC(3,2) NOT NULL DEFAULT 0.25,
        ADD COLUMN IF NOT EXISTS stroke_hex VARCHAR(7) NOT NULL DEFAULT '#1b4f72',
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gis.layer_features (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        layer_id UUID NOT NULL REFERENCES gis.gis_layers(id) ON DELETE CASCADE,
        layer_version_id UUID NOT NULL REFERENCES gis.layer_versions(id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS idx_layer_features_geom
        ON gis.layer_features USING GIST (geometry)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_layer_features_layer
        ON gis.layer_features (layer_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_layer_features_org
        ON gis.layer_features (organization_id) WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS gis.layer_features`);
    await queryRunner.query(`
      ALTER TABLE gis.gis_layers
        DROP COLUMN IF EXISTS category,
        DROP COLUMN IF EXISTS color_hex,
        DROP COLUMN IF EXISTS fill_opacity,
        DROP COLUMN IF EXISTS stroke_hex,
        DROP COLUMN IF EXISTS sort_order
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS gis.urban_layer_category_enum`);
  }
}
