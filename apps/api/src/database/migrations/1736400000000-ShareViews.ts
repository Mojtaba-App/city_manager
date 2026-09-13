import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShareViews1736400000000 implements MigrationInterface {
  name = 'ShareViews1736400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case".share_views (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES core.organizations(id),
        kind VARCHAR(20) NOT NULL,
        title VARCHAR(300) NOT NULL,
        caption TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        token_hash VARCHAR(128) NOT NULL,
        token_hint VARCHAR(12) NOT NULL,
        snapshot JSONB NOT NULL DEFAULT '{}',
        expires_at TIMESTAMPTZ,
        view_count INT NOT NULL DEFAULT 0,
        last_viewed_at TIMESTAMPTZ,
        created_by UUID REFERENCES core.users(id),
        recipient_label VARCHAR(200),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_share_views_token_hash
        ON "case".share_views (token_hash)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_share_views_org
        ON "case".share_views (organization_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "case".idx_share_views_org`);
    await queryRunner.query(`DROP INDEX IF EXISTS "case".idx_share_views_token_hash`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case".share_views`);
  }
}
