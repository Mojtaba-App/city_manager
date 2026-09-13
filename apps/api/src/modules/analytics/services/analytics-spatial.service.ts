import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HeatmapPoint, NeighborhoodChoropleth, resolveDisplayedHouseholdCount, resolveDisplayedOptionalMetric, resolveDisplayedPopulation } from '@city-manager/shared';
import { AnalyticsFilterDto } from '../dto/analytics.dto';

@Injectable()
export class AnalyticsSpatialService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async vulnerabilityHeatmap(orgId: string | null, filters: AnalyticsFilterDto = {}) {
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (orgId) {
      parts.push(`AND h.organization_id = $${i++}`);
      params.push(orgId);
    }
    if (filters.neighborhoodIds?.length) {
      parts.push(`AND h.neighborhood_id = ANY($${i++})`);
      params.push(filters.neighborhoodIds);
    }
    if (filters.householdStatuses?.length) {
      parts.push(`AND h.status = ANY($${i++})`);
      params.push(filters.householdStatuses);
    }

    const rows = await this.safeQuery(`
      SELECT
        h.id AS household_id,
        h.case_number,
        ST_X(d.location::geometry) AS lng,
        ST_Y(d.location::geometry) AS lat,
        COALESCE(
          (h.custom_fields->>'vulnerabilityScore')::float,
          CASE
            WHEN avg_income.avg < 5000000 THEN 8
            WHEN avg_income.avg < 10000000 THEN 6
            WHEN avg_income.avg < 20000000 THEN 4
            ELSE 2
          END
          + CASE WHEN o.ownership_type = 'tenant' THEN 1.5 ELSE 0 END
          + CASE WHEN unemployed.cnt > 0 THEN 1 ELSE 0 END
        ) AS weight
      FROM "case".households h
      JOIN "case".dwellings d ON d.id = h.dwelling_id
      LEFT JOIN "case".ownership_records o ON o.household_id = h.id AND o.is_current = true
      LEFT JOIN LATERAL (
        SELECT AVG(fm.monthly_income)::float AS avg
        FROM "case".family_members fm
        WHERE fm.household_id = h.id AND fm.deleted_at IS NULL
      ) avg_income ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM "case".family_members fm
        WHERE fm.household_id = h.id AND fm.deleted_at IS NULL
          AND fm.employment_status = 'unemployed'
      ) unemployed ON true
      WHERE h.deleted_at IS NULL
        AND d.location IS NOT NULL
        ${parts.join(' ')}
    `, params);

    const points: HeatmapPoint[] = rows
      .filter((r: { lng: number; lat: number }) => r.lng != null && r.lat != null)
      .map((r: { household_id: string; case_number: string; lng: number; lat: number; weight: number }) => ({
        lng: Number(r.lng),
        lat: Number(r.lat),
        weight: Math.min(10, Math.max(1, Number(r.weight) || 1)),
        householdId: r.household_id,
        label: r.case_number,
      }));

    return {
      success: true,
      data: {
        type: 'FeatureCollection',
        features: points.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { weight: p.weight, householdId: p.householdId, label: p.label },
        })),
        points,
      },
    };
  }

  async neighborhoodChoropleth(orgId: string | null, filters: AnalyticsFilterDto = {}) {
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (orgId) {
      parts.push(`AND n.organization_id = $${i++}`);
      params.push(orgId);
    }
    if (filters.neighborhoodIds?.length) {
      parts.push(`AND n.id = ANY($${i++})`);
      params.push(filters.neighborhoodIds);
    }

    const rows = await this.safeQuery(`
      SELECT
        n.id AS neighborhood_id,
        n.name,
        n.code,
        n.area_sqm,
        n.population AS registered_population,
        n.household_count AS registered_household_count,
        n.avg_income AS registered_avg_income,
        n.literacy_rate AS registered_literacy_rate,
        COUNT(DISTINCT h.id) FILTER (WHERE h.deleted_at IS NULL)::int AS case_household_count,
        COUNT(DISTINCT fm.id) FILTER (WHERE fm.deleted_at IS NULL)::int AS member_count,
        AVG(fm.monthly_income) FILTER (WHERE fm.deleted_at IS NULL)::float AS case_avg_income,
        AVG(COALESCE((h.custom_fields->>'vulnerabilityScore')::float, NULL))::float AS avg_vulnerability,
        CASE
          WHEN COUNT(DISTINCT fm.id) FILTER (WHERE fm.deleted_at IS NULL) = 0 THEN NULL
          ELSE ROUND(
            (
              COUNT(DISTINCT fm.id) FILTER (
                WHERE fm.deleted_at IS NULL
                  AND fm.education_level IS NOT NULL
                  AND fm.education_level <> 'none'
              )::numeric
              * 100
              / NULLIF(COUNT(DISTINCT fm.id) FILTER (WHERE fm.deleted_at IS NULL), 0)
            )::numeric
          , 1)::float
        END AS case_literacy_rate,
        ST_AsGeoJSON(n.boundary)::json AS geometry
      FROM program.neighborhoods n
      LEFT JOIN "case".households h ON h.neighborhood_id = n.id
      LEFT JOIN "case".family_members fm ON fm.household_id = h.id AND fm.deleted_at IS NULL
      WHERE n.deleted_at IS NULL ${parts.join(' ')}
      GROUP BY n.id, n.name, n.code, n.area_sqm, n.population, n.household_count, n.avg_income, n.literacy_rate, n.boundary
      ORDER BY COALESCE(n.household_count, COUNT(DISTINCT h.id) FILTER (WHERE h.deleted_at IS NULL)) DESC
    `, params);

    const data: NeighborhoodChoropleth[] = rows.map((r: Record<string, unknown>) => ({
      neighborhoodId: String(r.neighborhood_id),
      name: String(r.name),
      code: r.code ? String(r.code) : undefined,
      householdCount: resolveDisplayedHouseholdCount(r.registered_household_count, r.case_household_count),
      population: resolveDisplayedPopulation(r.registered_population, r.member_count),
      avgIncome: resolveDisplayedOptionalMetric(r.registered_avg_income, r.case_avg_income),
      literacyRate: resolveDisplayedOptionalMetric(r.registered_literacy_rate, r.case_literacy_rate),
      areaSqm: r.area_sqm != null ? Number(r.area_sqm) : undefined,
      avgVulnerability: r.avg_vulnerability != null ? Number(r.avg_vulnerability) : undefined,
      geometry: (r.geometry as Record<string, unknown>) ?? null,
    }));

    return { success: true, data };
  }

  private async safeQuery(sql: string, params: unknown[]) {
    try {
      return await this.ds.query(sql, params);
    } catch {
      return [];
    }
  }
}
