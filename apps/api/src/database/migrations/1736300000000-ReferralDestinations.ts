import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReferralDestinations1736300000000 implements MigrationInterface {
  name = 'ReferralDestinations1736300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        ALTER COLUMN agency_id DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        ADD COLUMN IF NOT EXISTS destination_kind VARCHAR(40) NOT NULL DEFAULT 'partner_agency'
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        ADD COLUMN IF NOT EXISTS municipal_district SMALLINT
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        ADD COLUMN IF NOT EXISTS destination_code VARCHAR(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        ADD COLUMN IF NOT EXISTS destination_label VARCHAR(200)
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        ADD COLUMN IF NOT EXISTS audience_organization_id UUID
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        ADD COLUMN IF NOT EXISTS access_enabled BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE "case".agency_referrals r
      SET destination_kind = COALESCE(NULLIF(destination_kind, ''), 'partner_agency'),
          destination_code = COALESCE(destination_code, a.code),
          destination_label = COALESCE(destination_label, a.name)
      FROM core.agencies a
      WHERE r.agency_id = a.id
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agency_referrals_destination
        ON "case".agency_referrals (organization_id, destination_kind, municipal_district, status)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agency_referrals_audience
        ON "case".agency_referrals (audience_organization_id, status)
        WHERE deleted_at IS NULL AND audience_organization_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "case".idx_agency_referrals_audience`);
    await queryRunner.query(`DROP INDEX IF EXISTS "case".idx_agency_referrals_destination`);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        DROP COLUMN IF EXISTS access_enabled
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        DROP COLUMN IF EXISTS audience_organization_id
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        DROP COLUMN IF EXISTS destination_label
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        DROP COLUMN IF EXISTS destination_code
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        DROP COLUMN IF EXISTS municipal_district
    `);
    await queryRunner.query(`
      ALTER TABLE "case".agency_referrals
        DROP COLUMN IF EXISTS destination_kind
    `);
  }
}
