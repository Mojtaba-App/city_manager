import { MigrationInterface, QueryRunner } from 'typeorm';

export class AreaProjects1735200000000 implements MigrationInterface {
  name = 'AreaProjects1735200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS program.area_projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        target_id UUID NOT NULL,
        name VARCHAR(300) NOT NULL,
        project_kind VARCHAR(30) NOT NULL DEFAULT 'executive',
        party_role VARCHAR(30),
        party_name VARCHAR(300),
        amount NUMERIC(18, 0),
        currency VARCHAR(10) NOT NULL DEFAULT 'IRR',
        status VARCHAR(30) NOT NULL DEFAULT 'planned',
        contract_number VARCHAR(100),
        start_date DATE,
        end_date DATE,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_area_projects_org
        ON program.area_projects (organization_id)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_area_projects_target
        ON program.area_projects (target_type, target_id)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS program.area_projects`);
  }
}
