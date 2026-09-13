import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityModule1734800000000 implements MigrationInterface {
  name = 'SecurityModule1734800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS security`);

    await queryRunner.query(`
      ALTER TABLE audit.audit_logs
        ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) NOT NULL DEFAULT 'success',
        ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'info',
        ADD COLUMN IF NOT EXISTS request_id VARCHAR(64)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit.audit_logs (action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit.audit_logs (resource);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit.audit_logs (outcome);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.user_geo_scopes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        zone_id UUID,
        neighborhood_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, neighborhood_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_geo_scopes_user ON core.user_geo_scopes (user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS security.abac_policies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID REFERENCES core.organizations(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        effect VARCHAR(10) NOT NULL DEFAULT 'allow',
        priority INTEGER NOT NULL DEFAULT 100,
        resource_type VARCHAR(100) NOT NULL,
        actions JSONB NOT NULL DEFAULT '[]',
        condition JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS security.oauth_clients (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        client_id VARCHAR(100) NOT NULL UNIQUE,
        client_secret_hash VARCHAR(200) NOT NULL,
        name VARCHAR(200) NOT NULL,
        scopes JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS security.managed_secrets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        key VARCHAR(200) NOT NULL,
        description TEXT,
        ciphertext TEXT NOT NULL,
        key_version INTEGER NOT NULL DEFAULT 1,
        rotated_at TIMESTAMPTZ,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, key)
      )
    `);

    // Seed baseline ABAC policies (org-scoped deny-by-default complement to RBAC)
    await queryRunner.query(`
      INSERT INTO security.abac_policies (name, description, effect, priority, resource_type, actions, condition, is_active)
      SELECT 'org_isolation', 'رد دسترسی بین سازمانی', 'deny', 10, '*', '["*"]'::jsonb,
             '{"orgMatch": true}'::jsonb, true
      WHERE NOT EXISTS (SELECT 1 FROM security.abac_policies WHERE name = 'org_isolation' AND organization_id IS NULL)
    `);

    await queryRunner.query(`
      INSERT INTO security.abac_policies (name, description, effect, priority, resource_type, actions, condition, is_active)
      SELECT 'geo_scope_household', 'دسترسی خانوار فقط در محدوده جغرافیایی کاربر', 'allow', 50, 'household',
             '["read","write"]'::jsonb,
             '{"orgMatch": true, "neighborhoodInScope": true}'::jsonb, true
      WHERE NOT EXISTS (SELECT 1 FROM security.abac_policies WHERE name = 'geo_scope_household' AND organization_id IS NULL)
    `);

    await queryRunner.query(`
      INSERT INTO security.abac_policies (name, description, effect, priority, resource_type, actions, condition, is_active)
      SELECT 'pii_purpose_limitation', 'خواندن PII فقط با مجوز field-level', 'allow', 40, 'member',
             '["read_pii"]'::jsonb,
             '{"orgMatch": true, "hasPermission": "members:read_pii"}'::jsonb, true
      WHERE NOT EXISTS (SELECT 1 FROM security.abac_policies WHERE name = 'pii_purpose_limitation' AND organization_id IS NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS security.managed_secrets`);
    await queryRunner.query(`DROP TABLE IF EXISTS security.oauth_clients`);
    await queryRunner.query(`DROP TABLE IF EXISTS security.abac_policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.user_geo_scopes`);
    await queryRunner.query(`
      ALTER TABLE audit.audit_logs
        DROP COLUMN IF EXISTS outcome,
        DROP COLUMN IF EXISTS severity,
        DROP COLUMN IF EXISTS request_id
    `);
    await queryRunner.query(`DROP SCHEMA IF EXISTS security`);
  }
}
