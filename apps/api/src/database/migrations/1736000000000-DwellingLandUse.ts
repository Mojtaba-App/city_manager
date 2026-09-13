import { MigrationInterface, QueryRunner } from 'typeorm';

export class DwellingLandUse1736000000000 implements MigrationInterface {
  name = 'DwellingLandUse1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".dwellings
        ADD COLUMN IF NOT EXISTS land_use VARCHAR(40)
    `);
    await queryRunner.query(`
      UPDATE "case".dwellings d
      SET land_use = h.land_use
      FROM "case".households h
      WHERE h.dwelling_id = d.id
        AND h.land_use IS NOT NULL
        AND d.land_use IS NULL
        AND h.deleted_at IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "case".households DROP COLUMN IF EXISTS land_use`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".households
        ADD COLUMN IF NOT EXISTS land_use VARCHAR(40)
    `);
    await queryRunner.query(`
      UPDATE "case".households h
      SET land_use = d.land_use
      FROM "case".dwellings d
      WHERE h.dwelling_id = d.id
        AND d.land_use IS NOT NULL
        AND h.land_use IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "case".dwellings DROP COLUMN IF EXISTS land_use`);
  }
}
