import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsModule1734600000000 implements MigrationInterface {
  name = 'AnalyticsModule1734600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS analytics`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analytics.report_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        code VARCHAR(100) NOT NULL,
        name VARCHAR(300) NOT NULL,
        description TEXT,
        query_template TEXT,
        parameters JSONB NOT NULL DEFAULT '{}',
        includes_pii BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analytics.report_snapshots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES analytics.report_definitions(id) ON DELETE SET NULL,
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        report_code VARCHAR(100) NOT NULL,
        period_label VARCHAR(100),
        parameters JSONB NOT NULL DEFAULT '{}',
        result_data JSONB NOT NULL,
        generated_by UUID REFERENCES core.users(id),
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analytics.kpi_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        code VARCHAR(100) NOT NULL,
        title VARCHAR(300) NOT NULL,
        metric VARCHAR(100) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        sort_order SMALLINT NOT NULL DEFAULT 0,
        config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_report_snapshots_org
      ON analytics.report_snapshots(organization_id, generated_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_kpi_definitions_org
      ON analytics.kpi_definitions(organization_id, sort_order)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS analytics.kpi_definitions`);
    await queryRunner.query(`DROP TABLE IF EXISTS analytics.report_snapshots`);
    await queryRunner.query(`DROP TABLE IF EXISTS analytics.report_definitions`);
  }
}
