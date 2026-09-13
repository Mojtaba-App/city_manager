import { MigrationInterface, QueryRunner } from 'typeorm';

export class NeighborhoodSocioStats1736100000000 implements MigrationInterface {
  name = 'NeighborhoodSocioStats1736100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ADD COLUMN IF NOT EXISTS household_count INTEGER,
        ADD COLUMN IF NOT EXISTS avg_income NUMERIC(14, 2),
        ADD COLUMN IF NOT EXISTS literacy_rate NUMERIC(5, 2)
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        DROP CONSTRAINT IF EXISTS neighborhoods_household_count_chk
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ADD CONSTRAINT neighborhoods_household_count_chk
        CHECK (household_count IS NULL OR household_count >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        DROP CONSTRAINT IF EXISTS neighborhoods_avg_income_chk
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ADD CONSTRAINT neighborhoods_avg_income_chk
        CHECK (avg_income IS NULL OR avg_income >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        DROP CONSTRAINT IF EXISTS neighborhoods_literacy_rate_chk
    `);
    await queryRunner.query(`
      ALTER TABLE program.neighborhoods
        ADD CONSTRAINT neighborhoods_literacy_rate_chk
        CHECK (literacy_rate IS NULL OR (literacy_rate >= 0 AND literacy_rate <= 100))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_literacy_rate_chk`);
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_avg_income_chk`);
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_household_count_chk`);
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP COLUMN IF EXISTS literacy_rate`);
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP COLUMN IF EXISTS avg_income`);
    await queryRunner.query(`ALTER TABLE program.neighborhoods DROP COLUMN IF EXISTS household_count`);
  }
}
