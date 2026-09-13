import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAccountStatus1736900000000 implements MigrationInterface {
  name = 'UserAccountStatus1736900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.users
      ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
      ADD COLUMN IF NOT EXISTS last_login_user_agent TEXT,
      ADD COLUMN IF NOT EXISTS inactive_reason TEXT,
      ADD COLUMN IF NOT EXISTS inactive_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS inactive_by UUID
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.users
      DROP COLUMN IF EXISTS last_login_ip,
      DROP COLUMN IF EXISTS last_login_user_agent,
      DROP COLUMN IF EXISTS inactive_reason,
      DROP COLUMN IF EXISTS inactive_at,
      DROP COLUMN IF EXISTS inactive_by
    `);
  }
}
