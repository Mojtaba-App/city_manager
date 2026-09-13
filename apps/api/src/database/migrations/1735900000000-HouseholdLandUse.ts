import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseholdLandUse1735900000000 implements MigrationInterface {
  name = 'HouseholdLandUse1735900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".households
        ADD COLUMN IF NOT EXISTS land_use VARCHAR(40)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "case".households DROP COLUMN IF EXISTS land_use`);
  }
}
