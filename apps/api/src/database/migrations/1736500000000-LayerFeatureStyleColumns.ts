import { MigrationInterface, QueryRunner } from 'typeorm';

export class LayerFeatureStyleColumns1736500000000 implements MigrationInterface {
  name = 'LayerFeatureStyleColumns1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gis.layer_features
        ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7),
        ADD COLUMN IF NOT EXISTS fill_opacity NUMERIC(4,3)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gis.layer_features
        DROP COLUMN IF EXISTS color_hex,
        DROP COLUMN IF EXISTS fill_opacity
    `);
  }
}
