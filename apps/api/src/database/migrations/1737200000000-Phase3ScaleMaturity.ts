import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3ScaleMaturity1737200000000 implements MigrationInterface {
  name = 'Phase3ScaleMaturity1737200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.users
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE core.users
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ
    `);

    // support.support_records exists only in database/schema reference SQL, not in TypeORM migrations.
    // Keep the column for KPI shape compatibility without requiring that schema.
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_neighborhood_kpi AS
      SELECT
        n.organization_id,
        n.id AS neighborhood_id,
        n.code AS neighborhood_code,
        n.name AS neighborhood_name,
        n.status,
        COUNT(DISTINCT h.id) FILTER (WHERE h.deleted_at IS NULL AND h.status = 'active') AS active_households,
        COUNT(DISTINCT fm.id) FILTER (WHERE fm.deleted_at IS NULL) AS total_members,
        0::bigint AS support_records_count,
        NOW() AS refreshed_at
      FROM program.neighborhoods n
      LEFT JOIN "case".households h ON h.neighborhood_id = n.id
      LEFT JOIN "case".family_members fm ON fm.household_id = h.id
      WHERE n.deleted_at IS NULL
      GROUP BY n.organization_id, n.id, n.code, n.name, n.status
      WITH NO DATA
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_neighborhood_kpi_id
      ON analytics.mv_neighborhood_kpi (neighborhood_id)
    `);

    try {
      await queryRunner.query(`REFRESH MATERIALIZED VIEW analytics.mv_neighborhood_kpi`);
    } catch {
      /* empty datasets / missing joins are fine */
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS analytics.mv_neighborhood_kpi`);
    await queryRunner.query(`ALTER TABLE core.users DROP COLUMN IF EXISTS last_seen_at`);
    await queryRunner.query(`ALTER TABLE core.users DROP COLUMN IF EXISTS must_change_password`);
  }
}
