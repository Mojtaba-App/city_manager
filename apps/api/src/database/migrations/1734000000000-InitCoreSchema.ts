import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitCoreSchema1734000000000 implements MigrationInterface {
  name = 'InitCoreSchema1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS core`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS gis`);

    await queryRunner.query(`
      CREATE TYPE core.system_role_enum AS ENUM (
        'super_admin', 'org_admin', 'manager',
        'social_worker', 'analyst', 'viewer'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE core.organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(200) NOT NULL UNIQUE,
        name VARCHAR(300) NOT NULL,
        name_en VARCHAR(300),
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE core.roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code core.system_role_enum NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSONB NOT NULL DEFAULT '[]',
        is_system BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE core.users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID REFERENCES core.organizations(id),
        email VARCHAR(320) NOT NULL UNIQUE,
        password_hash VARCHAR(200) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_email_verified BOOLEAN NOT NULL DEFAULT false,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_users_org ON core.users(organization_id)`);

    await queryRunner.query(`
      CREATE TABLE core.user_roles (
        user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, role_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE core.refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
        token_hash VARCHAR(512) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_user ON core.refresh_tokens(user_id)`);

    await queryRunner.query(`
      CREATE TABLE audit.audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        organization_id UUID,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(100),
        payload JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_user ON audit.audit_logs(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_org ON audit.audit_logs(organization_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_created ON audit.audit_logs(created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit.audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.user_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.users`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.organizations`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.system_role_enum`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS gis CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS audit CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS core CASCADE`);
  }
}
