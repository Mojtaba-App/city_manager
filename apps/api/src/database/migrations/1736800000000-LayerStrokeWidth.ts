import { MigrationInterface, QueryRunner } from 'typeorm';

export class LayerStrokeWidth1736800000000 implements MigrationInterface {
  name = 'LayerStrokeWidth1736800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gis.gis_layers
        ADD COLUMN IF NOT EXISTS stroke_width NUMERIC(4,2) NOT NULL DEFAULT 2.5
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gis.gis_layers DROP COLUMN IF EXISTS stroke_width
    `);
  }
}
