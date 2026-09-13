import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Neighborhood } from '../entities/neighborhood.entity';
import {
  CreateNeighborhoodDto,
  UpdateNeighborhoodDto,
} from '../dto/gis.dto';
import { GeometryService } from './geometry.service';
import { ProgramContextService } from './program-context.service';
import { ApiResponse } from '@city-manager/shared';

@Injectable()
export class NeighborhoodsService {
  constructor(
    @InjectRepository(Neighborhood)
    private readonly repo: Repository<Neighborhood>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly geometryService: GeometryService,
    private readonly programContext: ProgramContextService,
  ) {}

  async findAll(orgId: string): Promise<ApiResponse<unknown[]>> {
    const rows = await this.dataSource.query(
      `SELECT n.id, n.code, n.name, n.status, n.area_sqm, n.priority_rank,
              n.municipal_district, n.population, n.household_count, n.avg_income, n.literacy_rate, n.metadata,
              n.created_at, n.updated_at,
              (n.boundary IS NOT NULL) AS has_geometry,
              ST_AsGeoJSON(n.boundary)::json AS geometry,
              ST_AsGeoJSON(n.centroid)::json AS centroid,
              COALESCE(hh.case_household_count, 0)::int AS case_household_count,
              hh.avg_vulnerability,
              COALESCE(proj.project_count, 0)::int AS project_count,
              COALESCE(proj.active_project_count, 0)::int AS active_project_count
       FROM program.neighborhoods n
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS case_household_count,
                ROUND(AVG(h.vulnerability_score)::numeric, 1) AS avg_vulnerability
         FROM "case".households h
         WHERE h.organization_id = n.organization_id
           AND h.neighborhood_id = n.id
           AND h.deleted_at IS NULL
       ) hh ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS project_count,
                COUNT(*) FILTER (WHERE p.status = 'active')::int AS active_project_count
         FROM program.area_projects p
         WHERE p.organization_id = n.organization_id
           AND p.target_type = 'neighborhood'
           AND p.target_id = n.id
           AND p.deleted_at IS NULL
       ) proj ON TRUE
       WHERE n.organization_id = $1 AND n.deleted_at IS NULL
       ORDER BY n.name`,
      [orgId],
    );
    return { success: true, data: rows };
  }

  async findOne(orgId: string, id: string): Promise<ApiResponse<unknown>> {
    const rows = await this.dataSource.query(
      `SELECT n.*, ST_AsGeoJSON(n.boundary)::json AS geometry,
              ST_AsGeoJSON(n.centroid)::json AS centroid
       FROM program.neighborhoods n
       WHERE n.id = $1 AND n.organization_id = $2 AND n.deleted_at IS NULL`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('محله یافت نشد');
    return { success: true, data: rows[0] };
  }

  async create(orgId: string, dto: CreateNeighborhoodDto): Promise<ApiResponse<unknown>> {
    const programId = await this.programContext.getDefaultProgramId(orgId);

    if (!dto.geometry) {
      const rows = await this.dataSource.query(
        `INSERT INTO program.neighborhoods
          (organization_id, program_id, code, name, status, boundary, centroid, area_sqm, priority_rank, metadata, municipal_district, population, household_count, avg_income, literacy_rate)
         VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, code, name, status, area_sqm, municipal_district, population, household_count, avg_income, literacy_rate`,
        [
          orgId,
          programId,
          dto.code,
          dto.name,
          dto.status ?? 'planned',
          dto.areaSqm ?? null,
          dto.priorityRank ?? null,
          dto.metadata ? JSON.stringify(dto.metadata) : null,
          dto.municipalDistrict ?? null,
          dto.population ?? null,
          dto.householdCount ?? null,
          dto.avgIncome ?? null,
          dto.literacyRate ?? null,
        ],
      );
      return { success: true, data: { ...rows[0], has_geometry: false } };
    }

    const geoJson = JSON.stringify(dto.geometry);
    const valid = await this.geometryService.isValidGeometry(geoJson);
    if (!valid) throw new BadRequestException('هندسه نامعتبر است');

    const areaSqm = dto.areaSqm ?? await this.geometryService.computeAreaSqm(geoJson);

    const rows = await this.dataSource.query(
      `INSERT INTO program.neighborhoods
        (organization_id, program_id, code, name, status, boundary, centroid, area_sqm, priority_rank, metadata, municipal_district, population, household_count, avg_income, literacy_rate)
       VALUES (
         $1, $2, $3, $4, $5,
         ST_Multi(ST_CollectionExtract(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)), 3)),
         ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)),
         $7, $8, $9, $10, $11, $12, $13, $14
       )
       RETURNING id, code, name, status, area_sqm, municipal_district, population, household_count, avg_income, literacy_rate`,
      [
        orgId,
        programId,
        dto.code,
        dto.name,
        dto.status ?? 'planned',
        geoJson,
        areaSqm,
        dto.priorityRank ?? null,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        dto.municipalDistrict ?? null,
        dto.population ?? null,
        dto.householdCount ?? null,
        dto.avgIncome ?? null,
        dto.literacyRate ?? null,
      ],
    );
    return { success: true, data: { ...rows[0], has_geometry: true } };
  }

  async createBatch(
    orgId: string,
    items: Array<{
      code: string;
      name: string;
      geometry: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      status?: string;
    }>,
  ): Promise<number> {
    if (!items.length) return 0;
    const programId = await this.programContext.getDefaultProgramId(orgId);
    let inserted = 0;
    const CHUNK = 25;
    for (let offset = 0; offset < items.length; offset += CHUNK) {
      const chunk = items.slice(offset, offset + CHUNK);
      for (const item of chunk) {
        try {
          const geoJson = JSON.stringify(item.geometry);
          const valid = await this.geometryService.isValidGeometry(geoJson);
          if (!valid) continue;
          const areaSqm = await this.geometryService.computeAreaSqm(geoJson);
          await this.dataSource.query(
            `INSERT INTO program.neighborhoods
              (organization_id, program_id, code, name, status, boundary, centroid, area_sqm, metadata)
             VALUES (
               $1, $2, $3, $4, $5,
               ST_Multi(ST_CollectionExtract(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)), 3)),
               ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)),
               $7, $8
             )`,
            [
              orgId,
              programId,
              item.code,
              item.name,
              item.status ?? 'planned',
              geoJson,
              areaSqm,
              item.metadata ? JSON.stringify(item.metadata) : null,
            ],
          );
          inserted += 1;
        } catch {
          /* skip invalid row */
        }
      }
    }
    return inserted;
  }

  async update(orgId: string, id: string, dto: UpdateNeighborhoodDto): Promise<ApiResponse<unknown>> {
    const existing = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('محله یافت نشد');

    if (dto.name !== undefined) existing.name = dto.name;
    if (dto.status !== undefined) existing.status = dto.status;
    if (dto.priorityRank !== undefined) existing.priorityRank = dto.priorityRank;
    if (dto.municipalDistrict !== undefined) existing.municipalDistrict = dto.municipalDistrict;
    if (dto.population !== undefined) existing.population = dto.population;
    if (dto.householdCount !== undefined) existing.householdCount = dto.householdCount;
    if (dto.avgIncome !== undefined) existing.avgIncome = dto.avgIncome;
    if (dto.literacyRate !== undefined) existing.literacyRate = dto.literacyRate;
    if (dto.areaSqm !== undefined) existing.areaSqm = dto.areaSqm;
    if (dto.metadata !== undefined) {
      existing.metadata = { ...(existing.metadata ?? {}), ...dto.metadata };
    }
    await this.repo.save(existing);
    return this.findOne(orgId, id);
  }

  async updateGeometry(orgId: string, id: string, geometry: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const geoJson = JSON.stringify(geometry);
    const valid = await this.geometryService.isValidGeometry(geoJson);
    if (!valid) throw new BadRequestException('هندسه نامعتبر است');

    const areaSqm = await this.geometryService.computeAreaSqm(geoJson);
    const rows = await this.dataSource.query(
      `UPDATE program.neighborhoods SET
         boundary = ST_Multi(ST_CollectionExtract(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)), 3)),
         centroid = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
         area_sqm = $4,
         updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id, code, name, area_sqm`,
      [id, orgId, geoJson, areaSqm],
    );
    if (!rows[0]) throw new NotFoundException('محله یافت نشد');
    return { success: true, data: rows[0] };
  }

  async softDelete(orgId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    const rows = await this.dataSource.query(
      `UPDATE program.neighborhoods SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('محله یافت نشد');
    return { success: true, data: { id } };
  }

  async getDetailForPopup(orgId: string, id: string) {
    const neighborhood = await this.findOne(orgId, id);
    const stats = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM gis.fabrics f WHERE f.neighborhood_id = $1 AND f.deleted_at IS NULL) AS fabric_count,
         (SELECT COUNT(*) FROM "case".dwellings d WHERE d.neighborhood_id = $1 AND d.deleted_at IS NULL) AS dwelling_count`,
      [id],
    );
    const base = neighborhood.data as Record<string, unknown>;
    return {
      featureType: 'neighborhood',
      ...base,
      stats: stats[0],
    };
  }

  async getContainedData(orgId: string, id: string) {
    const fabrics = await this.dataSource.query(
      `SELECT f.id, f.code, f.name, ft.name AS fabric_type, ft.color_hex,
              ST_AsGeoJSON(f.geometry)::json AS geometry
       FROM gis.fabrics f
       JOIN gis.fabric_types ft ON ft.id = f.fabric_type_id
       WHERE f.neighborhood_id = $1 AND f.organization_id = $2 AND f.deleted_at IS NULL`,
      [id, orgId],
    );
    const dwellings = await this.dataSource.query(
      `SELECT d.id, d.dwelling_code, d.title, d.full_address,
              ST_AsGeoJSON(d.location)::json AS geometry
       FROM "case".dwellings d
       WHERE d.neighborhood_id = $1 AND d.organization_id = $2 AND d.deleted_at IS NULL`,
      [id, orgId],
    );
    return { fabrics, dwellings };
  }

  async getDashboard(orgId: string, id: string): Promise<ApiResponse<Record<string, unknown>>> {
    const nbRes = await this.findOne(orgId, id);
    const neighborhood = nbRes.data as Record<string, unknown>;

    const [[hh], [mem], [vuln], [proj]] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM "case".households
         WHERE organization_id = $1 AND neighborhood_id = $2 AND deleted_at IS NULL`,
        [orgId, id],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM "case".family_members fm
         JOIN "case".households h ON h.id = fm.household_id
         WHERE h.organization_id = $1 AND h.neighborhood_id = $2
           AND fm.deleted_at IS NULL AND h.deleted_at IS NULL`,
        [orgId, id],
      ),
      this.dataSource.query(
        `SELECT ROUND(AVG(vulnerability_score)::numeric, 1) AS avg_score
         FROM "case".households
         WHERE organization_id = $1 AND neighborhood_id = $2
           AND deleted_at IS NULL AND vulnerability_score IS NOT NULL`,
        [orgId, id],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                COALESCE(SUM(amount), 0) AS budget,
                COALESCE(ROUND(AVG(progress_percent)::numeric, 0), 0) AS avg_progress
         FROM program.area_projects
         WHERE organization_id = $1 AND target_type = 'neighborhood'
           AND target_id = $2 AND deleted_at IS NULL`,
        [orgId, id],
      ),
    ]);

    const projects = await this.dataSource.query(
      `SELECT id, name, status, progress_percent, amount, contractor_name, project_kind
       FROM program.area_projects
       WHERE organization_id = $1 AND target_type = 'neighborhood'
         AND target_id = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 20`,
      [orgId, id],
    );

    return {
      success: true,
      data: {
        neighborhood,
        householdCount: hh?.c ?? 0,
        memberCount: mem?.c ?? 0,
        avgVulnerability: vuln?.avg_score != null ? Number(vuln.avg_score) : null,
        projectCount: proj?.total ?? 0,
        activeProjectCount: proj?.active ?? 0,
        totalProjectBudget: Number(proj?.budget ?? 0),
        avgProgress: Number(proj?.avg_progress ?? 0),
        projects,
      },
    };
  }
}
