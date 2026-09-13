import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserProfileFields1735000000000 implements MigrationInterface {
  name = 'UserProfileFields1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.users
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS job_title VARCHAR(150),
      ADD COLUMN IF NOT EXISTS department VARCHAR(150),
      ADD COLUMN IF NOT EXISTS bio TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.users
      DROP COLUMN IF EXISTS avatar_url,
      DROP COLUMN IF EXISTS job_title,
      DROP COLUMN IF EXISTS department,
      DROP COLUMN IF EXISTS bio
    `);
  }
}
