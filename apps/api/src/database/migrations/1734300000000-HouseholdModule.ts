import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseholdModule1734300000000 implements MigrationInterface {
  name = 'HouseholdModule1734300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".household_status_enum AS ENUM (
          'draft', 'active', 'suspended', 'graduated', 'withdrawn', 'archived'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".ownership_type_enum AS ENUM (
          'owner', 'tenant', 'rent_free', 'cooperative', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".member_role_enum AS ENUM (
          'head', 'spouse', 'child', 'parent', 'relative', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".gender_enum AS ENUM (
          'male', 'female', 'other', 'unknown'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".education_level_enum AS ENUM (
          'none', 'primary', 'middle', 'high_school', 'diploma',
          'associate', 'bachelor', 'master', 'doctorate', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".employment_status_enum AS ENUM (
          'employed', 'self_employed', 'unemployed', 'student',
          'retired', 'homemaker', 'disabled', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // Agencies
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.agencies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        code VARCHAR(100) NOT NULL,
        name VARCHAR(300) NOT NULL,
        agency_type VARCHAR(100),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(320),
        address TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE (organization_id, code)
      )
    `);

    // Extend dwellings
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS province VARCHAR(100)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS district VARCHAR(100)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS street VARCHAR(300)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS alley VARCHAR(200)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS plaque VARCHAR(50)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS unit VARCHAR(50)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(10, 2)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS floor_count SMALLINT`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS unit_count SMALLINT`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS construction_year SMALLINT`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326)`);
    await queryRunner.query(`ALTER TABLE "case".dwellings ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".households (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        neighborhood_id UUID REFERENCES program.neighborhoods(id),
        dwelling_id UUID NOT NULL REFERENCES "case".dwellings(id),
        case_number VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
        head_member_id UUID,
        member_count SMALLINT NOT NULL DEFAULT 0,
        notes TEXT,
        custom_fields JSONB NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE (organization_id, case_number)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".household_status_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        from_status VARCHAR(50),
        to_status VARCHAR(50) NOT NULL,
        reason TEXT,
        changed_by UUID REFERENCES core.users(id),
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".family_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        member_role VARCHAR(50) NOT NULL DEFAULT 'other',
        is_beneficiary BOOLEAN NOT NULL DEFAULT true,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        gender VARCHAR(20) NOT NULL DEFAULT 'unknown',
        birth_date DATE,
        father_name VARCHAR(100),
        mother_name VARCHAR(100),
        marital_status VARCHAR(50),
        national_id_enc TEXT,
        national_id_hash VARCHAR(64),
        phone_enc TEXT,
        phone_hash VARCHAR(64),
        education_level VARCHAR(50),
        education_field VARCHAR(200),
        employment_status VARCHAR(50),
        job_title VARCHAR(200),
        monthly_income NUMERIC(14, 2),
        is_identity_verified BOOLEAN NOT NULL DEFAULT false,
        left_household_at DATE,
        left_reason VARCHAR(200),
        custom_fields JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "case".households
          ADD CONSTRAINT households_head_member_fk
          FOREIGN KEY (head_member_id) REFERENCES "case".family_members(id);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".ownership_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dwelling_id UUID NOT NULL REFERENCES "case".dwellings(id) ON DELETE CASCADE,
        household_id UUID REFERENCES "case".households(id),
        ownership_type VARCHAR(50) NOT NULL,
        owner_name VARCHAR(300),
        lease_start_date DATE,
        lease_end_date DATE,
        monthly_rent NUMERIC(14, 2),
        document_reference VARCHAR(200),
        is_current BOOLEAN NOT NULL DEFAULT true,
        recorded_by UUID REFERENCES core.users(id),
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".insurance_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        member_id UUID REFERENCES "case".family_members(id),
        agency_id UUID REFERENCES core.agencies(id),
        insurance_type VARCHAR(100) NOT NULL,
        policy_number_enc TEXT,
        coverage_start DATE,
        coverage_end DATE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".entity_change_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL,
        changed_by UUID REFERENCES core.users(id),
        old_values JSONB,
        new_values JSONB,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".form_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        entity_type VARCHAR(100) NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        name VARCHAR(200) NOT NULL,
        schema JSONB NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, entity_type, version)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_households_org ON "case".households(organization_id) WHERE deleted_at IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_households_dwelling ON "case".households(dwelling_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_members_household ON "case".family_members(household_id) WHERE deleted_at IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_members_national_hash ON "case".family_members(national_id_hash) WHERE national_id_hash IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_change_logs_entity ON "case".entity_change_logs(entity_type, entity_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_insurance_household ON "case".insurance_records(household_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "case".form_definitions`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".entity_change_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".insurance_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".ownership_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".family_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".household_status_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".households`);
  }
}
