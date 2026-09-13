import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollaborationChannels1735600000000 implements MigrationInterface {
  name = 'CollaborationChannels1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.in_app_notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(300) NOT NULL,
        body TEXT,
        link VARCHAR(500),
        metadata JSONB,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON core.in_app_notifications (user_id, is_read, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_org
        ON core.in_app_notifications (organization_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".data_consents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id),
        purpose VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        scope_fields JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        evidence_document_id UUID,
        granted_by_name VARCHAR(200),
        granted_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_data_consents_hh
        ON "case".data_consents (household_id, status) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".agency_referrals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id),
        agency_id UUID NOT NULL REFERENCES core.agencies(id),
        consent_id UUID REFERENCES "case".data_consents(id),
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        purpose VARCHAR(50) NOT NULL DEFAULT 'agency_referral',
        title VARCHAR(300) NOT NULL,
        notes TEXT,
        scope_fields JSONB NOT NULL DEFAULT '["case_summary","member_count"]',
        payload_snapshot JSONB,
        external_reference VARCHAR(200),
        connector_id UUID,
        sent_at TIMESTAMPTZ,
        responded_at TIMESTAMPTZ,
        response_notes TEXT,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agency_referrals_org
        ON "case".agency_referrals (organization_id, status) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agency_referrals_hh
        ON "case".agency_referrals (household_id) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".portal_invites (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        household_id UUID NOT NULL REFERENCES "case".households(id),
        invite_code_hash VARCHAR(128) NOT NULL,
        invite_code_hint VARCHAR(12) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        recipient_name VARCHAR(200),
        recipient_phone VARCHAR(20),
        expires_at TIMESTAMPTZ NOT NULL,
        activated_at TIMESTAMPTZ,
        last_access_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_invites_code_hash
        ON "case".portal_invites (invite_code_hash)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portal_invites_hh
        ON "case".portal_invites (household_id, status)
    `);

    await queryRunner.query(`
      ALTER TABLE "case".field_visits
        ADD COLUMN IF NOT EXISTS photo_document_ids JSONB NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "case".field_visits DROP COLUMN IF EXISTS photo_document_ids`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".portal_invites`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".agency_referrals`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".data_consents`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.in_app_notifications`);
  }
}
