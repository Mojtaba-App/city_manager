import { MigrationInterface, QueryRunner } from 'typeorm';

/** Remove per-feature KML colour columns — styling is layer-wide only. */
export class DropLayerFeatureStyleColumns1736700000000 implements MigrationInterface {
  name = 'DropLayerFeatureStyleColumns1736700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gis.layer_features
        DROP COLUMN IF EXISTS color_hex,
        DROP COLUMN IF EXISTS fill_opacity
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gis.layer_features
        ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7),
        ADD COLUMN IF NOT EXISTS fill_opacity NUMERIC(4,3)
    `);
  }
}
