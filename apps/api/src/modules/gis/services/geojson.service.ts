import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GeoJsonFeatureCollection, GisFeatureType, featureMapLabel } from '@city-manager/shared';
import { BEST_PUBLISHED_VERSIONS_CTE, PUBLISHED_LAYER_VERSION_JOIN } from '../gis-layer-version.sql';

type Bbox = [number, number, number, number];

type LayerFetchOptions = {
  layers?: string[];
  neighborhoodIds?: string[];
  fabricTypeIds?: string[];
  urbanLayerIds?: string[];
  bbox?: Bbox;
  zoom?: number;
  limit?: number;
  offset?: number;
};

const GEOJSON_HARD_CAP = 50_000;

/** ~Meters-per-degree at Ahvaz latitude — used to keep simplify visually faithful. */
export function simplifyToleranceForZoom(zoom?: number): number {
  const z = zoom ?? 12;
  if (z >= 16) return 0;
  if (z >= 15) return 0.00002;
  if (z >= 14) return 0.00005;
  if (z >= 13) return 0.0001;
  if (z >= 12) return 0.00015;
  if (z >= 11) return 0.00022;
  return 0.00035;
}

const SIMPLIFIED_GEOMETRY_SQL = (geomExpr: string, simplifyIdx: number) => `
  ST_AsGeoJSON(
    CASE
      WHEN $${simplifyIdx}::double precision <= 0 THEN ${geomExpr}
      ELSE ST_SimplifyPreserveTopology(${geomExpr}, $${simplifyIdx}::double precision)
    END
  , 6)::json AS geometry`;

const URBAN_GEOMETRY_SQL = (simplifyIdx: number) => SIMPLIFIED_GEOMETRY_SQL('f.geometry', simplifyIdx);

const URBAN_VERSION_JOIN = PUBLISHED_LAYER_VERSION_JOIN;

@Injectable()
export class GeoJsonService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getLayers(orgId: string, options: LayerFetchOptions): Promise<GeoJsonFeatureCollection> {
    const layerSet = new Set(options.layers ?? ['neighborhoods', 'fabrics', 'dwellings', 'urban']);

    const jobs: Array<Promise<GeoJsonFeatureCollection['features']>> = [];

    const push = (label: string, run: () => Promise<GeoJsonFeatureCollection['features']>) => {
      jobs.push(
        run().catch((err) => {
          console.error(`[GeoJsonService] ${label} failed`, err);
          return [] as GeoJsonFeatureCollection['features'];
        }),
      );
    };

    if (layerSet.has('neighborhoods')) {
      push('neighborhoods', () => this.fetchNeighborhoods(orgId, options));
    }
    if (layerSet.has('fabrics')) {
      push('fabrics', () => this.fetchFabrics(orgId, options));
    }
    if (layerSet.has('dwellings')) {
      push('dwellings', () => this.fetchDwellings(orgId, options));
    }
    if (layerSet.has('urban')) {
      push('urban', () => this.fetchUrbanLayers(orgId, options));
    }

    const chunks = await Promise.all(jobs);
    // Avoid features.push(...chunk) — spread blows the call stack on large urban layers.
    let features = chunks.flat();
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(
      GEOJSON_HARD_CAP,
      Math.max(1, options.limit ?? GEOJSON_HARD_CAP),
    );
    if (offset > 0 || features.length > limit) {
      features = features.slice(offset, offset + limit);
    }
    return { type: 'FeatureCollection', features };
  }

  private async fetchNeighborhoods(
    orgId: string,
    options: { neighborhoodIds?: string[]; bbox?: Bbox; zoom?: number },
  ) {
    const params: unknown[] = [orgId];
    let filters = '';
    if (options.neighborhoodIds?.length) {
      params.push(options.neighborhoodIds);
      filters += ` AND n.id = ANY($${params.length})`;
    }
    if (options.bbox) {
      params.push(...options.bbox);
      filters += ` AND ST_Intersects(n.boundary, ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326))`;
    }
    params.push(simplifyToleranceForZoom(options.zoom));
    const simplifyIdx = params.length;

    const rows = await this.dataSource.query(
      `SELECT n.id, n.code, n.name, n.status, n.area_sqm,
              n.population, n.household_count, n.avg_income, n.literacy_rate,
              ${SIMPLIFIED_GEOMETRY_SQL('n.boundary', simplifyIdx)}
       FROM program.neighborhoods n
       WHERE n.organization_id = $1 AND n.deleted_at IS NULL AND n.boundary IS NOT NULL${filters}`,
      params,
    );

    return rows.map((r: Record<string, unknown>) => ({
      type: 'Feature' as const,
      id: r.id as string,
      geometry: r.geometry as GeoJsonFeatureCollection['features'][0]['geometry'],
      properties: {
        featureType: GisFeatureType.NEIGHBORHOOD,
        id: r.id,
        code: r.code,
        name: featureMapLabel({ name: r.name, code: r.code }) || r.name,
        status: r.status,
        areaSqm: r.area_sqm,
        population: r.population,
        householdCount: r.household_count,
        avgIncome: r.avg_income,
        literacyRate: r.literacy_rate,
        layer: 'neighborhoods',
      },
    }));
  }

  private async fetchFabrics(
    orgId: string,
    options: { neighborhoodIds?: string[]; fabricTypeIds?: string[]; bbox?: Bbox; zoom?: number },
  ) {
    const params: unknown[] = [orgId];
    let filters = '';
    if (options.neighborhoodIds?.length) {
      params.push(options.neighborhoodIds);
      filters += ` AND f.neighborhood_id = ANY($${params.length})`;
    }
    if (options.fabricTypeIds?.length) {
      params.push(options.fabricTypeIds);
      filters += ` AND f.fabric_type_id = ANY($${params.length})`;
    }
    if (options.bbox) {
      params.push(...options.bbox);
      filters += ` AND ST_Intersects(f.geometry, ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326))`;
    }
    params.push(simplifyToleranceForZoom(options.zoom));
    const simplifyIdx = params.length;

    const rows = await this.dataSource.query(
      `SELECT f.id, f.code, f.name, f.neighborhood_id, f.fabric_type_id, f.area_sqm,
              ft.name AS fabric_type_name, ft.color_hex, ft.fill_opacity,
              ${SIMPLIFIED_GEOMETRY_SQL('f.geometry', simplifyIdx)}
       FROM gis.fabrics f
       JOIN gis.fabric_types ft ON ft.id = f.fabric_type_id
       WHERE f.organization_id = $1 AND f.deleted_at IS NULL AND f.geometry IS NOT NULL AND ft.is_active = true${filters}`,
      params,
    );

    return rows.map((r: Record<string, unknown>) => ({
      type: 'Feature' as const,
      id: r.id as string,
      geometry: r.geometry as GeoJsonFeatureCollection['features'][0]['geometry'],
      properties: {
        featureType: GisFeatureType.FABRIC,
        id: r.id,
        code: r.code,
        name: featureMapLabel({ name: r.name, code: r.code }) || r.name,
        fabricTypeName: r.fabric_type_name,
        fabricTypeId: r.fabric_type_id,
        colorHex: r.color_hex,
        fillOpacity: Number(r.fill_opacity ?? 0.35),
        neighborhoodId: r.neighborhood_id,
        areaSqm: r.area_sqm,
        layer: 'fabrics',
      },
    }));
  }

  private async fetchDwellings(
    orgId: string,
    options: { neighborhoodIds?: string[]; bbox?: Bbox },
  ) {
    const params: unknown[] = [orgId];
    let filters = '';
    if (options.neighborhoodIds?.length) {
      params.push(options.neighborhoodIds);
      filters += ` AND d.neighborhood_id = ANY($${params.length})`;
    }
    if (options.bbox) {
      params.push(...options.bbox);
      filters += ` AND ST_Intersects(d.location, ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326))`;
    }

    const rows = await this.dataSource.query(
      `SELECT d.id, d.dwelling_code, d.title, d.full_address, d.building_type, d.neighborhood_id,
              ST_AsGeoJSON(d.location, 6)::json AS geometry
       FROM "case".dwellings d
       WHERE d.organization_id = $1 AND d.deleted_at IS NULL AND d.location IS NOT NULL${filters}
       ORDER BY d.created_at DESC NULLS LAST`,
      params,
    );

    return rows.map((r: Record<string, unknown>) => ({
      type: 'Feature' as const,
      id: r.id as string,
      geometry: r.geometry as GeoJsonFeatureCollection['features'][0]['geometry'],
      properties: {
        featureType: GisFeatureType.DWELLING,
        id: r.id,
        dwellingCode: r.dwelling_code,
        title: r.title,
        name: featureMapLabel({ title: r.title, dwellingCode: r.dwelling_code }),
        fullAddress: r.full_address,
        buildingType: r.building_type,
        neighborhoodId: r.neighborhood_id,
        layer: 'dwellings',
      },
    }));
  }

  /** Full urban layer features — no zoom-based feature caps. */
  private async fetchUrbanLayers(
    orgId: string,
    options: { urbanLayerIds?: string[]; bbox?: Bbox; zoom?: number },
  ) {
    const params: unknown[] = [orgId];
    let filters = '';
    if (options.urbanLayerIds?.length) {
      params.push(options.urbanLayerIds);
      filters += ` AND l.id = ANY($${params.length})`;
    }
    if (options.bbox) {
      params.push(...options.bbox);
      filters += ` AND ST_Intersects(f.geometry, ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326))`;
    }

    params.push(simplifyToleranceForZoom(options.zoom));
    const simplifyIdx = params.length;

    const rows = await this.dataSource.query(
      `WITH ${BEST_PUBLISHED_VERSIONS_CTE}
       SELECT f.id, f.code, f.name, f.area_sqm, f.layer_id, f.attributes,
              l.code AS layer_code, l.name AS layer_name, l.category,
              l.color_hex AS layer_color_hex,
              l.fill_opacity AS layer_fill_opacity,
              l.stroke_hex,
              l.stroke_width AS layer_stroke_width,
              ${URBAN_GEOMETRY_SQL(simplifyIdx)}
       FROM gis.layer_features f
       JOIN gis.gis_layers l ON l.id = f.layer_id
       ${URBAN_VERSION_JOIN}
       WHERE f.organization_id = $1
         AND f.deleted_at IS NULL
         AND f.is_active = true
         AND l.is_active = true
         ${filters}
       ORDER BY f.layer_id, f.id`,
      params,
    );

    return rows
      .filter((r: Record<string, unknown>) => r.geometry != null)
      .map((r: Record<string, unknown>) => ({
        type: 'Feature' as const,
        id: r.id as string,
        geometry: r.geometry as GeoJsonFeatureCollection['features'][0]['geometry'],
        properties: {
          featureType: GisFeatureType.LAYER_FEATURE,
          id: r.id,
          code: r.code,
          name:
            featureMapLabel({
              name: r.name,
              code: r.code,
            }) || r.name,
          layerId: r.layer_id,
          layerCode: r.layer_code,
          layerName: r.layer_name,
          category: r.category,
          colorHex: r.layer_color_hex,
          fillOpacity: Number(r.layer_fill_opacity ?? 0.25),
          strokeHex: r.stroke_hex,
          strokeWidth: Number(r.layer_stroke_width ?? 2.5),
          attributes: r.attributes ?? null,
          areaSqm: r.area_sqm,
          layer: 'urban',
        },
      }));
  }
}
