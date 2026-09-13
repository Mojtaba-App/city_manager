import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationalFeatures1735400000000 implements MigrationInterface {
  name = 'OperationalFeatures1735400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".households
        ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES core.users(id),
        ADD COLUMN IF NOT EXISTS vulnerability_score NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS vulnerability_level VARCHAR(20),
        ADD COLUMN IF NOT EXISTS priority_rank INTEGER,
        ADD COLUMN IF NOT EXISTS last_assessment_at TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_households_assigned
        ON "case".households (assigned_user_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_households_priority
        ON "case".households (priority_rank DESC NULLS LAST, vulnerability_score DESC NULLS LAST)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".case_task_type_enum AS ENUM (
          'general', 'follow_up', 'document_review', 'referral', 'visit', 'escalation'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".case_task_status_enum AS ENUM (
          'pending', 'in_progress', 'completed', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".case_task_priority_enum AS ENUM (
          'low', 'normal', 'high', 'urgent'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".case_tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        title VARCHAR(300) NOT NULL,
        description TEXT,
        task_type "case".case_task_type_enum NOT NULL DEFAULT 'general',
        status "case".case_task_status_enum NOT NULL DEFAULT 'pending',
        priority "case".case_task_priority_enum NOT NULL DEFAULT 'normal',
        assigned_user_id UUID REFERENCES core.users(id),
        created_by UUID REFERENCES core.users(id),
        due_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        checklist JSONB NOT NULL DEFAULT '[]',
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_case_tasks_household
        ON "case".case_tasks (household_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_case_tasks_assignee
        ON "case".case_tasks (assigned_user_id, status) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_case_tasks_due
        ON "case".case_tasks (due_at) WHERE deleted_at IS NULL AND status IN ('pending', 'in_progress')
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".field_visit_status_enum AS ENUM (
          'scheduled', 'completed', 'cancelled', 'no_show'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".field_visits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        task_id UUID REFERENCES "case".case_tasks(id) ON DELETE SET NULL,
        assigned_user_id UUID REFERENCES core.users(id),
        scheduled_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        status "case".field_visit_status_enum NOT NULL DEFAULT 'scheduled',
        address_note TEXT,
        findings TEXT,
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_field_visits_household
        ON "case".field_visits (household_id) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".support_package_category_enum AS ENUM (
          'livelihood', 'housing', 'employment', 'education', 'health', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".support_packages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        code VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        category "case".support_package_category_enum NOT NULL DEFAULT 'other',
        description TEXT,
        budget_amount NUMERIC(14,2),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE (organization_id, code)
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".support_assignment_status_enum AS ENUM (
          'planned', 'active', 'completed', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".household_support_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        package_id UUID NOT NULL REFERENCES "case".support_packages(id),
        status "case".support_assignment_status_enum NOT NULL DEFAULT 'planned',
        assigned_at DATE NOT NULL DEFAULT CURRENT_DATE,
        started_at DATE,
        completed_at DATE,
        amount NUMERIC(14,2),
        outcome_notes TEXT,
        assigned_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_support_assignments_household
        ON "case".household_support_assignments (household_id) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".household_document_category_enum AS ENUM (
          'identity', 'property', 'meeting', 'photo', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".household_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        title VARCHAR(300) NOT NULL,
        category "case".household_document_category_enum NOT NULL DEFAULT 'other',
        file_name VARCHAR(500) NOT NULL,
        content_type VARCHAR(120) NOT NULL,
        file_size BIGINT NOT NULL DEFAULT 0,
        storage_key VARCHAR(800) NOT NULL,
        uploaded_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_household_documents_household
        ON "case".household_documents (household_id) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".vulnerability_assessments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
        total_score NUMERIC(5,2) NOT NULL,
        level VARCHAR(20) NOT NULL,
        breakdown JSONB NOT NULL DEFAULT '{}',
        notes TEXT,
        assessed_by UUID REFERENCES core.users(id),
        assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_vulnerability_assessments_household
        ON "case".vulnerability_assessments (household_id, assessed_at DESC)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".message_channel_enum AS ENUM ('sms', 'email');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case".message_outbox_status_enum AS ENUM (
          'pending', 'sent', 'failed', 'skipped'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".message_outbox (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID REFERENCES "case".households(id) ON DELETE SET NULL,
        channel "case".message_channel_enum NOT NULL,
        recipient VARCHAR(300) NOT NULL,
        subject VARCHAR(500),
        body TEXT NOT NULL,
        template_code VARCHAR(100),
        event_type VARCHAR(100),
        status "case".message_outbox_status_enum NOT NULL DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_message_outbox_org
        ON "case".message_outbox (organization_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "case".message_outbox`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".message_outbox_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".message_channel_enum`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".vulnerability_assessments`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".household_documents`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".household_document_category_enum`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".household_support_assignments`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".support_assignment_status_enum`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".support_packages`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".support_package_category_enum`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".field_visits`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".field_visit_status_enum`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".case_tasks`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".case_task_priority_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".case_task_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case".case_task_type_enum`);
    await queryRunner.query(`
      ALTER TABLE "case".households
        DROP COLUMN IF EXISTS assigned_user_id,
        DROP COLUMN IF EXISTS vulnerability_score,
        DROP COLUMN IF EXISTS vulnerability_level,
        DROP COLUMN IF EXISTS priority_rank,
        DROP COLUMN IF EXISTS last_assessment_at
    `);
  }
}
