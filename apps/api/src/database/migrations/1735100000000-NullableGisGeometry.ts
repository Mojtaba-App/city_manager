import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableGisGeometry1735100000000 implements MigrationInterface {
  name = 'NullableGisGeometry1735100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ALTER COLUMN boundary DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE gis.fabrics
        ALTER COLUMN geometry DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM program.neighborhoods WHERE boundary IS NULL
    `);
    await queryRunner.query(`
      DELETE FROM gis.fabrics WHERE geometry IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ALTER COLUMN boundary SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE gis.fabrics
        ALTER COLUMN geometry SET NOT NULL
    `);
  }
}
