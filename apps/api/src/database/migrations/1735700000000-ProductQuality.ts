import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductQuality1735700000000 implements MigrationInterface {
  name = 'ProductQuality1735700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".dwellings
        ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'case',
        ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit.data_access_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        user_id UUID REFERENCES core.users(id),
        resource_type VARCHAR(50) NOT NULL,
        resource_id UUID,
        field_name VARCHAR(100),
        access_purpose VARCHAR(50) NOT NULL,
        access_reason TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_data_access_logs_org
        ON audit.data_access_logs (organization_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit.export_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        user_id UUID REFERENCES core.users(id),
        export_type VARCHAR(50) NOT NULL,
        resource_ref VARCHAR(200),
        access_reason TEXT,
        row_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS security.pii_access_grants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        user_id UUID NOT NULL REFERENCES core.users(id),
        resource_type VARCHAR(50) NOT NULL,
        resource_id UUID,
        fields JSONB NOT NULL DEFAULT '[]',
        purpose VARCHAR(50) NOT NULL,
        reason TEXT,
        granted_by UUID REFERENCES core.users(id),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pii_grants_user_active
        ON security.pii_access_grants (user_id, expires_at)
        WHERE revoked_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS security.pii_access_grants`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit.export_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit.data_access_logs`);
    await queryRunner.query(`
      ALTER TABLE "case".dwellings
        DROP COLUMN IF EXISTS source,
        DROP COLUMN IF EXISTS synced_at
    `);
  }
}
