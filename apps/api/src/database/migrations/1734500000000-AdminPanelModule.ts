import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminPanelModule1734500000000 implements MigrationInterface {
  name = 'AdminPanelModule1734500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.system_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID REFERENCES core.organizations(id),
        key VARCHAR(100) NOT NULL,
        value JSONB NOT NULL DEFAULT '{}',
        description TEXT,
        updated_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, key)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_org
      ON core.system_settings(organization_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created
      ON audit.audit_logs(created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_org
      ON audit.audit_logs(organization_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS core.system_settings`);
  }
}
