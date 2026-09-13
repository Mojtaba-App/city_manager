import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2ProductCompletion1737100000000 implements MigrationInterface {
  name = 'Phase2ProductCompletion1737100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".message_outbox
        ADD COLUMN IF NOT EXISTS attempt INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5,
        ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_message_outbox_dispatch
      ON "case".message_outbox (status, next_attempt_at)
      WHERE status IN ('pending', 'failed')
    `);

    await queryRunner.query(`
      ALTER TABLE core.roles
        ADD COLUMN IF NOT EXISTS organization_id UUID NULL
    `);
    await queryRunner.query(`
      ALTER TABLE core.roles
        ALTER COLUMN code TYPE VARCHAR(50)
        USING code::text
    `);
    await queryRunner.query(`
      ALTER TABLE core.roles
        ALTER COLUMN is_system SET DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration.sync_dead_letters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        connector_id UUID NOT NULL,
        sync_job_id UUID NULL,
        entity_type VARCHAR(100) NOT NULL DEFAULT 'custom',
        external_id VARCHAR(500) NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        error_message TEXT NOT NULL,
        attempt INT NOT NULL DEFAULT 1,
        status VARCHAR(30) NOT NULL DEFAULT 'dead',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        requeued_at TIMESTAMPTZ NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_dlq_org_status
      ON integration.sync_dead_letters (organization_id, status, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS integration.sync_dead_letters`);
    await queryRunner.query(`DROP INDEX IF EXISTS "case".idx_message_outbox_dispatch`);
    await queryRunner.query(`
      ALTER TABLE "case".message_outbox
        DROP COLUMN IF EXISTS attempt,
        DROP COLUMN IF EXISTS max_attempts,
        DROP COLUMN IF EXISTS next_attempt_at
    `);
    await queryRunner.query(`ALTER TABLE core.roles DROP COLUMN IF EXISTS organization_id`);
  }
}
