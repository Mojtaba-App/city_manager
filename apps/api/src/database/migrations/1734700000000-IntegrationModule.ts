import { MigrationInterface, QueryRunner } from 'typeorm';

export class IntegrationModule1734700000000 implements MigrationInterface {
  name = 'IntegrationModule1734700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS integration`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.connectors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        code VARCHAR(100) NOT NULL,
        name VARCHAR(300) NOT NULL,
        description TEXT,
        connector_type VARCHAR(50) NOT NULL DEFAULT 'rest_api',
        sync_direction VARCHAR(50) NOT NULL DEFAULT 'inbound',
        target_entity VARCHAR(100) NOT NULL DEFAULT 'household',
        connection_config JSONB NOT NULL DEFAULT '{}',
        auth_secrets_enc TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        schedule_cron VARCHAR(100),
        schedule_interval_minutes INTEGER,
        next_run_at TIMESTAMPTZ,
        last_sync_at TIMESTAMPTZ,
        last_sync_status VARCHAR(50),
        last_test_at TIMESTAMPTZ,
        last_test_ok BOOLEAN,
        last_test_message TEXT,
        created_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE (organization_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.field_mappings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        connector_id UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
        source_field VARCHAR(200) NOT NULL,
        target_field VARCHAR(200) NOT NULL,
        transform_rule JSONB NOT NULL DEFAULT '{}',
        is_required BOOLEAN NOT NULL DEFAULT false,
        sort_order SMALLINT NOT NULL DEFAULT 0,
        UNIQUE (connector_id, source_field)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.sync_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        connector_id UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        records_read INTEGER NOT NULL DEFAULT 0,
        records_written INTEGER NOT NULL DEFAULT 0,
        records_failed INTEGER NOT NULL DEFAULT 0,
        attempt INTEGER NOT NULL DEFAULT 1,
        error_summary TEXT,
        result_summary JSONB NOT NULL DEFAULT '{}',
        triggered_by UUID REFERENCES core.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.sync_job_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sync_job_id UUID NOT NULL REFERENCES integration.sync_jobs(id) ON DELETE CASCADE,
        log_level VARCHAR(20) NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        record_ref VARCHAR(200),
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.sync_queue (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        connector_id UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
        sync_job_id UUID REFERENCES integration.sync_jobs(id) ON DELETE SET NULL,
        queue_type VARCHAR(50) NOT NULL DEFAULT 'sync',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        attempt INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        payload JSONB NOT NULL DEFAULT '{}',
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.webhook_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        connector_id UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
        event_type VARCHAR(100),
        signature_valid BOOLEAN,
        headers JSONB NOT NULL DEFAULT '{}',
        payload JSONB NOT NULL DEFAULT '{}',
        processing_status VARCHAR(50) NOT NULL DEFAULT 'received',
        error_message TEXT,
        sync_job_id UUID REFERENCES integration.sync_jobs(id),
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.external_id_mappings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        connector_id UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
        entity_type VARCHAR(100) NOT NULL,
        internal_id UUID,
        external_id VARCHAR(500) NOT NULL,
        last_payload JSONB,
        last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (connector_id, entity_type, external_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.connection_tests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        connector_id UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
        success BOOLEAN NOT NULL,
        status_code INTEGER,
        latency_ms INTEGER,
        message TEXT,
        response_preview TEXT,
        tested_by UUID REFERENCES core.users(id),
        tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_connectors_org ON integration.connectors(organization_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_jobs_connector ON integration.sync_jobs(connector_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_queue_next ON integration.sync_queue(status, next_attempt_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhook_events_connector ON integration.webhook_events(connector_id, received_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS integration.connection_tests`);
    await queryRunner.query(`DROP TABLE IF EXISTS integration.external_id_mappings`);
    await queryRunner.query(`DROP TABLE IF EXISTS integration.webhook_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS integration.sync_queue`);
    await queryRunner.query(`DROP TABLE IF EXISTS integration.sync_job_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS integration.sync_jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS integration.field_mappings`);
    await queryRunner.query(`DROP TABLE IF EXISTS integration.connectors`);
  }
}
