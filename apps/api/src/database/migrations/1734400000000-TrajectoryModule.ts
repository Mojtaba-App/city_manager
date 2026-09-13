import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrajectoryModule1734400000000 implements MigrationInterface {
  name = 'TrajectoryModule1734400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS trajectory`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE trajectory.record_type_enum AS ENUM ('periodic_assessment', 'life_event');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE trajectory.life_event_type_enum AS ENUM (
          'job_change', 'income_change', 'housing_change', 'qol_change',
          'support_status_change', 'education_change', 'employment_change',
          'health_change', 'marriage', 'divorce', 'birth', 'death', 'migration', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE trajectory.support_status_enum AS ENUM (
          'none', 'applied', 'approved', 'receiving', 'suspended', 'graduated', 'withdrawn'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS trajectory.life_trajectory_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        member_id UUID REFERENCES "case".family_members(id),
        record_type VARCHAR(50) NOT NULL,
        period_start DATE,
        period_end DATE,
        event_type VARCHAR(50),
        event_date DATE NOT NULL,
        employment_status VARCHAR(50),
        job_title VARCHAR(200),
        employer_name VARCHAR(300),
        previous_job_title VARCHAR(200),
        monthly_income NUMERIC(14, 2),
        previous_income NUMERIC(14, 2),
        income_currency VARCHAR(3) NOT NULL DEFAULT 'IRR',
        education_level VARCHAR(50),
        education_field VARCHAR(200),
        dwelling_id UUID REFERENCES "case".dwellings(id),
        previous_dwelling_id UUID REFERENCES "case".dwellings(id),
        dwelling_address TEXT,
        previous_dwelling_address TEXT,
        quality_of_life_score SMALLINT CHECK (quality_of_life_score BETWEEN 1 AND 10),
        previous_qol_score SMALLINT CHECK (previous_qol_score BETWEEN 1 AND 10),
        qol_dimensions JSONB NOT NULL DEFAULT '{}',
        support_status VARCHAR(50),
        previous_support_status VARCHAR(50),
        support_agency_id UUID REFERENCES core.agencies(id),
        description TEXT,
        source VARCHAR(100) NOT NULL DEFAULT 'manual',
        recorded_by UUID REFERENCES core.users(id),
        version INTEGER NOT NULL DEFAULT 1,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS trajectory.trajectory_record_versions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        record_id UUID NOT NULL REFERENCES trajectory.life_trajectory_records(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        snapshot JSONB NOT NULL,
        changed_by UUID REFERENCES core.users(id),
        change_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (record_id, version)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS trajectory.expert_notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        member_id UUID REFERENCES "case".family_members(id),
        record_id UUID REFERENCES trajectory.life_trajectory_records(id) ON DELETE SET NULL,
        title VARCHAR(300),
        content TEXT NOT NULL,
        note_type VARCHAR(50) NOT NULL DEFAULT 'assessment',
        is_confidential BOOLEAN NOT NULL DEFAULT false,
        author_id UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_trajectory_household ON trajectory.life_trajectory_records(household_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_trajectory_member ON trajectory.life_trajectory_records(member_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_trajectory_event_date ON trajectory.life_trajectory_records(event_date DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_trajectory_event_type ON trajectory.life_trajectory_records(event_type)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_expert_notes_household ON trajectory.expert_notes(household_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS trajectory.expert_notes`);
    await queryRunner.query(`DROP TABLE IF EXISTS trajectory.trajectory_record_versions`);
    await queryRunner.query(`DROP TABLE IF EXISTS trajectory.life_trajectory_records`);
    await queryRunner.query(`DROP TYPE IF EXISTS trajectory.support_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS trajectory.life_event_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS trajectory.record_type_enum`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS trajectory CASCADE`);
  }
}
