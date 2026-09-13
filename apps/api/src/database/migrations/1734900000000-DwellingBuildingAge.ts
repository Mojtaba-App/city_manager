import { MigrationInterface, QueryRunner } from 'typeorm';

export class DwellingBuildingAge1734900000000 implements MigrationInterface {
  name = 'DwellingBuildingAge1734900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".dwellings
      ADD COLUMN IF NOT EXISTS building_age_years SMALLINT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".dwellings
      DROP COLUMN IF EXISTS building_age_years
    `);
  }
}
