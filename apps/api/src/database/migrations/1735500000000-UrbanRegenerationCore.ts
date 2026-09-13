import { MigrationInterface, QueryRunner } from 'typeorm';

export class UrbanRegenerationCore1735500000000 implements MigrationInterface {
  name = 'UrbanRegenerationCore1735500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE program.regeneration_programs
        ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS start_date DATE,
        ADD COLUMN IF NOT EXISTS end_date DATE,
        ADD COLUMN IF NOT EXISTS budget_total NUMERIC(18,0),
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
    `);

    await queryRunner.query(`
      ALTER TABLE program.area_projects
        ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES program.regeneration_programs(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(300),
        ADD COLUMN IF NOT EXISTS progress_percent SMALLINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS budget_spent NUMERIC(18,0),
        ADD COLUMN IF NOT EXISTS households_affected INTEGER NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_area_projects_program
        ON program.area_projects (program_id) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.report_schedules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        report_code VARCHAR(100) NOT NULL,
        title VARCHAR(300) NOT NULL,
        frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
        recipients JSONB NOT NULL DEFAULT '[]',
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_report_schedules_org
        ON core.report_schedules (organization_id, is_enabled)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS core.report_schedules`);
    await queryRunner.query(`
      ALTER TABLE program.area_projects
        DROP COLUMN IF EXISTS program_id,
        DROP COLUMN IF EXISTS contractor_name,
        DROP COLUMN IF EXISTS progress_percent,
        DROP COLUMN IF EXISTS budget_spent,
        DROP COLUMN IF EXISTS households_affected
    `);
    await queryRunner.query(`
      ALTER TABLE program.regeneration_programs
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS start_date,
        DROP COLUMN IF EXISTS end_date,
        DROP COLUMN IF EXISTS budget_total,
        DROP COLUMN IF EXISTS deleted_at
    `);
  }
}
