/**
 * GIS layer version SQL — optimized CTEs (avoid correlated subqueries per row).
 */

/** Latest published version per layer (fast default). */
export const LATEST_PUBLISHED_VERSIONS_CTE = `
  latest_published AS (
    SELECT DISTINCT ON (v.layer_id)
      v.layer_id,
      v.id AS version_id,
      v.version_number
    FROM gis.layer_versions v
    WHERE v.status = 'published'
    ORDER BY v.layer_id, v.version_number DESC
  )`;

/**
 * Published version with the most features per layer (handles empty re-import).
 */
export const BEST_PUBLISHED_VERSIONS_CTE = `
  version_feat_counts AS (
    SELECT
      v.layer_id,
      v.id AS version_id,
      v.version_number,
      COUNT(f.id)::bigint AS feat_count
    FROM gis.layer_versions v
    LEFT JOIN gis.layer_features f
      ON f.layer_version_id = v.id AND f.deleted_at IS NULL
    WHERE v.status = 'published'
    GROUP BY v.layer_id, v.id, v.version_number
  ),
  best_published AS (
    SELECT DISTINCT ON (layer_id)
      layer_id,
      version_id,
      version_number,
      feat_count
    FROM version_feat_counts
    ORDER BY layer_id, feat_count DESC, version_number DESC
  )`;

/** Join features to best published version (use after BEST_PUBLISHED_VERSIONS_CTE). */
export const JOIN_BEST_PUBLISHED_VERSION = `
  JOIN best_published bp ON bp.version_id = f.layer_version_id AND bp.layer_id = f.layer_id`;

/** Legacy alias used in geojson service (requires WITH clause prefix). */
export const PUBLISHED_LAYER_VERSION_JOIN = JOIN_BEST_PUBLISHED_VERSION;

/** Optimized urban layer list — single query for findAll. */
export function buildUrbanLayerListSql(orgParamIdx = 1): string {
  return `
    WITH ${BEST_PUBLISHED_VERSIONS_CTE},
    layer_bounds AS (
      SELECT
        f.layer_id,
        json_build_object(
          'west', ST_XMin(ST_Extent(f.geometry)),
          'south', ST_YMin(ST_Extent(f.geometry)),
          'east', ST_XMax(ST_Extent(f.geometry)),
          'north', ST_YMax(ST_Extent(f.geometry))
        ) AS bounds
      FROM gis.layer_features f
      ${JOIN_BEST_PUBLISHED_VERSION}
      WHERE f.deleted_at IS NULL AND f.geometry IS NOT NULL
      GROUP BY f.layer_id
    )
    SELECT
      l.id, l.code, l.name, l.description, l.category, l.geometry_type,
      l.color_hex, l.fill_opacity, l.stroke_hex, l.stroke_width, l.sort_order, l.is_active,
      l.created_at, l.updated_at,
      COALESCE(bp.feat_count, 0)::int AS feature_count,
      bp.version_number AS published_version,
      lb.bounds
    FROM gis.gis_layers l
    LEFT JOIN best_published bp ON bp.layer_id = l.id
    LEFT JOIN layer_bounds lb ON lb.layer_id = l.id
    WHERE l.organization_id = $${orgParamIdx}
    ORDER BY l.sort_order ASC, l.name ASC`;
}
