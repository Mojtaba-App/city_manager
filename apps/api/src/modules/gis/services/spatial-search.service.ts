import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { flattenGisAttributes, GisFeatureType } from '@city-manager/shared';

@Injectable()
export class SpatialSearchService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async searchNearby(orgId: string, lat: number, lng: number, radiusMeters = 500) {
    const point = JSON.stringify({ type: 'Point', coordinates: [lng, lat] });

    const neighborhoods = await this.dataSource.query(
      `SELECT n.id, n.code, n.name, n.status,
              ST_Distance(n.boundary::geography, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography) AS distance_m
       FROM program.neighborhoods n
       WHERE n.organization_id = $1 AND n.deleted_at IS NULL
         AND ST_DWithin(n.boundary::geography, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, $3)
       ORDER BY distance_m LIMIT 20`,
      [orgId, point, radiusMeters],
    );

    const fabrics = await this.dataSource.query(
      `SELECT f.id, f.code, f.name, ft.name AS fabric_type,
              ST_Distance(f.geometry::geography, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography) AS distance_m
       FROM gis.fabrics f
       JOIN gis.fabric_types ft ON ft.id = f.fabric_type_id
       WHERE f.organization_id = $1 AND f.deleted_at IS NULL
         AND ST_DWithin(f.geometry::geography, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, $3)
       ORDER BY distance_m LIMIT 20`,
      [orgId, point, radiusMeters],
    );

    const dwellings = await this.dataSource.query(
      `SELECT d.id, d.dwelling_code, d.title,
              ST_Distance(d.location::geography, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography) AS distance_m
       FROM "case".dwellings d
       WHERE d.organization_id = $1 AND d.deleted_at IS NULL AND d.location IS NOT NULL
         AND ST_DWithin(d.location::geography, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, $3)
       ORDER BY distance_m LIMIT 20`,
      [orgId, point, radiusMeters],
    );

    return { neighborhoods, fabrics, dwellings, center: { lat, lng }, radiusMeters };
  }

  async findAtPoint(orgId: string, lat: number, lng: number) {
    const point = JSON.stringify({ type: 'Point', coordinates: [lng, lat] });

    const neighborhood = await this.dataSource.query(
      `SELECT n.id, n.code, n.name FROM program.neighborhoods n
       WHERE n.organization_id = $1 AND n.deleted_at IS NULL
         AND ST_Contains(n.boundary, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
       LIMIT 1`,
      [orgId, point],
    );

    const fabric = await this.dataSource.query(
      `SELECT f.id, f.code, f.name, ft.name AS fabric_type FROM gis.fabrics f
       JOIN gis.fabric_types ft ON ft.id = f.fabric_type_id
       WHERE f.organization_id = $1 AND f.deleted_at IS NULL
         AND ST_Contains(f.geometry, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
       LIMIT 1`,
      [orgId, point],
    );

    return {
      point: { lat, lng },
      neighborhood: neighborhood[0] ?? null,
      fabric: fabric[0] ?? null,
    };
  }

  async getFeatureDetail(orgId: string, featureType: GisFeatureType, id: string) {
    switch (featureType) {
      case GisFeatureType.NEIGHBORHOOD:
        return this.neighborhoodDetail(orgId, id);
      case GisFeatureType.FABRIC:
        return this.fabricDetail(orgId, id);
      case GisFeatureType.DWELLING:
        return this.dwellingDetail(orgId, id);
      case GisFeatureType.LAYER_FEATURE:
        return this.layerFeatureDetail(orgId, id);
      default:
        return null;
    }
  }

  private async neighborhoodDetail(orgId: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT n.*, ST_AsGeoJSON(n.boundary)::json AS geometry
       FROM program.neighborhoods n
       WHERE n.id = $1 AND n.organization_id = $2 AND n.deleted_at IS NULL`,
      [id, orgId],
    );
    return rows[0] ? { featureType: GisFeatureType.NEIGHBORHOOD, ...rows[0] } : null;
  }

  private async fabricDetail(orgId: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT f.*, ft.name AS fabric_type_name, ft.color_hex,
              ST_AsGeoJSON(f.geometry)::json AS geometry
       FROM gis.fabrics f
       JOIN gis.fabric_types ft ON ft.id = f.fabric_type_id
       WHERE f.id = $1 AND f.organization_id = $2 AND f.deleted_at IS NULL`,
      [id, orgId],
    );
    if (!rows[0]) return null;
    const row = rows[0] as Record<string, unknown>;
    const attrs = row.attributes;
    return {
      featureType: GisFeatureType.FABRIC,
      ...row,
      attributes: flattenGisAttributes(
        attrs && typeof attrs === 'object' && !Array.isArray(attrs)
          ? (attrs as Record<string, unknown>)
          : null,
      ) ?? attrs,
    };
  }

  private async dwellingDetail(orgId: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT d.*, ST_AsGeoJSON(d.location)::json AS geometry
       FROM "case".dwellings d
       WHERE d.id = $1 AND d.organization_id = $2 AND d.deleted_at IS NULL`,
      [id, orgId],
    );
    return rows[0] ? { featureType: GisFeatureType.DWELLING, ...rows[0] } : null;
  }

  private async layerFeatureDetail(orgId: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT f.*, l.name AS layer_name, l.code AS layer_code, l.category,
              ST_AsGeoJSON(f.geometry)::json AS geometry
       FROM gis.layer_features f
       JOIN gis.gis_layers l ON l.id = f.layer_id
       WHERE f.id = $1 AND f.organization_id = $2 AND f.deleted_at IS NULL`,
      [id, orgId],
    );
    if (!rows[0]) return null;
    const row = rows[0] as Record<string, unknown>;
    const rawAttrs = row.attributes;
    const parsed =
      typeof rawAttrs === 'string'
        ? (() => {
            try {
              return JSON.parse(rawAttrs) as Record<string, unknown>;
            } catch {
              return null;
            }
          })()
        : rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs)
          ? (rawAttrs as Record<string, unknown>)
          : null;
    return {
      featureType: GisFeatureType.LAYER_FEATURE,
      ...row,
      attributes: flattenGisAttributes(parsed) ?? parsed,
    };
  }
}
