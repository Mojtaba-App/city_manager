import { MigrationInterface, QueryRunner } from 'typeorm';

export class NeighborhoodProfile1735800000000 implements MigrationInterface {
  name = 'NeighborhoodProfile1735800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE program.neighborhood_status_enum ADD VALUE IF NOT EXISTS 'joint_action';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ADD COLUMN IF NOT EXISTS municipal_district SMALLINT,
        ADD COLUMN IF NOT EXISTS population INTEGER
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        DROP CONSTRAINT IF EXISTS neighborhoods_municipal_district_chk
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ADD CONSTRAINT neighborhoods_municipal_district_chk
        CHECK (municipal_district IS NULL OR (municipal_district BETWEEN 1 AND 8))
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        DROP CONSTRAINT IF EXISTS neighborhoods_population_chk
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ADD CONSTRAINT neighborhoods_population_chk
        CHECK (population IS NULL OR population >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_population_chk`);
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_municipal_district_chk`);
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP COLUMN IF EXISTS population`);
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP COLUMN IF EXISTS municipal_district`);
  }
}
