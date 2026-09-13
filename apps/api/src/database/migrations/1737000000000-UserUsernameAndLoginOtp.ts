import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserUsernameAndLoginOtp1737000000000 implements MigrationInterface {
  name = 'UserUsernameAndLoginOtp1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.users
      ADD COLUMN IF NOT EXISTS username VARCHAR(50) NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username
      ON core.users (username)
      WHERE username IS NOT NULL AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS core.uq_users_username`);
    await queryRunner.query(`ALTER TABLE core.users DROP COLUMN IF EXISTS username`);
  }
}
