import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill per-feature colours from KML attributes stored during import.
 * QGIS exports often set fill-opacity to 0 and put the visible colour in stroke.
 */
export class BackfillLayerFeatureColors1736600000000 implements MigrationInterface {
  name = 'BackfillLayerFeatureColors1736600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE gis.layer_features f
      SET
        color_hex = sub.color_hex,
        fill_opacity = sub.fill_opacity
      FROM (
        SELECT
          id,
          CASE
            WHEN COALESCE(
              NULLIF(TRIM(attributes->>'fill-opacity'), '')::double precision,
              NULLIF(TRIM(attributes->>'fillOpacity'), '')::double precision,
              1
            ) <= 0 THEN
              CASE
                WHEN TRIM(COALESCE(attributes->>'stroke', '')) ~ '^#[0-9a-fA-F]{6}$'
                  THEN lower(TRIM(attributes->>'stroke'))
                WHEN TRIM(COALESCE(attributes->>'stroke', '')) ~ '^[0-9a-fA-F]{6}$'
                  THEN lower('#' || TRIM(attributes->>'stroke'))
                ELSE NULL
              END
            ELSE
              CASE
                WHEN TRIM(COALESCE(attributes->>'fill', '')) ~ '^#[0-9a-fA-F]{6}$'
                  THEN lower(TRIM(attributes->>'fill'))
                WHEN TRIM(COALESCE(attributes->>'fill', '')) ~ '^[0-9a-fA-F]{6}$'
                  THEN lower('#' || TRIM(attributes->>'fill'))
                ELSE NULL
              END
          END AS color_hex,
          CASE
            WHEN COALESCE(
              NULLIF(TRIM(attributes->>'fill-opacity'), '')::double precision,
              NULLIF(TRIM(attributes->>'fillOpacity'), '')::double precision,
              1
            ) <= 0 THEN 0
            ELSE COALESCE(
              NULLIF(TRIM(attributes->>'fill-opacity'), '')::double precision,
              NULLIF(TRIM(attributes->>'fillOpacity'), '')::double precision,
              0.35
            )
          END AS fill_opacity
        FROM gis.layer_features
        WHERE color_hex IS NULL
          AND attributes IS NOT NULL
          AND (
            attributes ? 'fill'
            OR attributes ? 'stroke'
            OR attributes ? 'fill-opacity'
            OR attributes ? 'fillOpacity'
          )
      ) sub
      WHERE f.id = sub.id
        AND sub.color_hex IS NOT NULL
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive backfill — no rollback.
  }
}
