import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Fabric } from '../entities/fabric.entity';
import { CreateFabricDto } from '../dto/gis.dto';
import { GeometryService } from './geometry.service';
import { FabricTypesService } from './fabric-types.service';
import { ApiResponse } from '@city-manager/shared';

@Injectable()
export class FabricsService {
  constructor(
    @InjectRepository(Fabric)
    private readonly repo: Repository<Fabric>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly geometryService: GeometryService,
    private readonly fabricTypesService: FabricTypesService,
  ) {}

  async findAll(orgId: string, neighborhoodId?: string): Promise<ApiResponse<unknown[]>> {
    const params: unknown[] = [orgId];
    let filter = '';
    if (neighborhoodId) {
      params.push(neighborhoodId);
      filter = ` AND f.neighborhood_id = $${params.length}`;
    }
    const rows = await this.dataSource.query(
      `SELECT f.id, f.code, f.name, f.neighborhood_id, f.fabric_type_id,
              f.area_sqm, ft.name AS fabric_type_name, ft.color_hex, ft.fill_opacity,
              (f.geometry IS NOT NULL) AS has_geometry,
              ST_AsGeoJSON(f.geometry)::json AS geometry
       FROM gis.fabrics f
       JOIN gis.fabric_types ft ON ft.id = f.fabric_type_id
       WHERE f.organization_id = $1 AND f.deleted_at IS NULL${filter}
       ORDER BY f.name`,
      params,
    );
    return { success: true, data: rows };
  }

  async create(orgId: string, dto: CreateFabricDto): Promise<ApiResponse<unknown>> {
    await this.fabricTypesService.getOrThrow(orgId, dto.fabricTypeId);

    if (!dto.geometry) {
      const rows = await this.dataSource.query(
        `INSERT INTO gis.fabrics
          (organization_id, neighborhood_id, fabric_type_id, code, name, geometry, area_sqm, attributes)
         VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)
         RETURNING id, code, name, fabric_type_id, area_sqm`,
        [
          orgId,
          dto.neighborhoodId ?? null,
          dto.fabricTypeId,
          dto.code ?? null,
          dto.name ?? null,
          dto.attributes ? JSON.stringify(dto.attributes) : null,
        ],
      );
      return { success: true, data: { ...rows[0], has_geometry: false } };
    }

    const geoJson = JSON.stringify(dto.geometry);
    const valid = await this.geometryService.isValidGeometry(geoJson);
    if (!valid) throw new BadRequestException('هندسه نامعتبر است');

    const areaSqm = await this.geometryService.computeAreaSqm(geoJson);
    const rows = await this.dataSource.query(
      `INSERT INTO gis.fabrics
        (organization_id, neighborhood_id, fabric_type_id, code, name, geometry, area_sqm, attributes)
       VALUES (
         $1, $2, $3, $4, $5,
         ST_Multi(ST_CollectionExtract(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)), 3)),
         $7, $8
       )
       RETURNING id, code, name, fabric_type_id, area_sqm`,
      [
        orgId,
        dto.neighborhoodId ?? null,
        dto.fabricTypeId,
        dto.code ?? null,
        dto.name ?? null,
        geoJson,
        areaSqm,
        dto.attributes ? JSON.stringify(dto.attributes) : null,
      ],
    );
    return { success: true, data: { ...rows[0], has_geometry: true } };
  }

  async createBatch(
    orgId: string,
    fabricTypeId: string,
    items: Array<{
      code?: string;
      name?: string;
      neighborhoodId?: string;
      geometry: Record<string, unknown>;
      attributes?: Record<string, unknown>;
    }>,
  ): Promise<number> {
    await this.fabricTypesService.getOrThrow(orgId, fabricTypeId);
    if (!items.length) return 0;
    let inserted = 0;
    for (const item of items) {
      try {
        const geoJson = JSON.stringify(item.geometry);
        const valid = await this.geometryService.isValidGeometry(geoJson);
        if (!valid) continue;
        const areaSqm = await this.geometryService.computeAreaSqm(geoJson);
        await this.dataSource.query(
          `INSERT INTO gis.fabrics
            (organization_id, neighborhood_id, fabric_type_id, code, name, geometry, area_sqm, attributes)
           VALUES (
             $1, $2, $3, $4, $5,
             ST_Multi(ST_CollectionExtract(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)), 3)),
             $7, $8
           )`,
          [
            orgId,
            item.neighborhoodId ?? null,
            fabricTypeId,
            item.code ?? null,
            item.name ?? null,
            geoJson,
            areaSqm,
            item.attributes ? JSON.stringify(item.attributes) : null,
          ],
        );
        inserted += 1;
      } catch {
        /* skip */
      }
    }
    return inserted;
  }

  async updateGeometry(orgId: string, id: string, geometry: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const geoJson = JSON.stringify(geometry);
    const valid = await this.geometryService.isValidGeometry(geoJson);
    if (!valid) throw new BadRequestException('هندسه نامعتبر است');

    const areaSqm = await this.geometryService.computeAreaSqm(geoJson);
    const rows = await this.dataSource.query(
      `UPDATE gis.fabrics SET
         geometry = ST_Multi(ST_CollectionExtract(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)), 3)),
         area_sqm = $4, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id, code, name, area_sqm`,
      [id, orgId, geoJson, areaSqm],
    );
    if (!rows[0]) throw new NotFoundException('بافت یافت نشد');
    return { success: true, data: rows[0] };
  }

  async updateMeta(
    orgId: string,
    id: string,
    dto: { fabricTypeId?: string; name?: string },
  ): Promise<ApiResponse<unknown>> {
    if (dto.fabricTypeId) {
      await this.fabricTypesService.getOrThrow(orgId, dto.fabricTypeId);
    }
    const rows = await this.dataSource.query(
      `UPDATE gis.fabrics SET
         fabric_type_id = COALESCE($3, fabric_type_id),
         name = COALESCE($4, name),
         updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id, code, name, fabric_type_id`,
      [id, orgId, dto.fabricTypeId ?? null, dto.name?.trim() || null],
    );
    if (!rows[0]) throw new NotFoundException('بافت یافت نشد');
    return { success: true, data: rows[0] };
  }

  async softDelete(orgId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    const rows = await this.dataSource.query(
      `UPDATE gis.fabrics SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('بافت یافت نشد');
    return { success: true, data: { id } };
  }

  async getDetailForPopup(orgId: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT f.*, ft.name AS fabric_type_name, ft.color_hex,
              n.name AS neighborhood_name,
              ST_AsGeoJSON(f.geometry)::json AS geometry
       FROM gis.fabrics f
       JOIN gis.fabric_types ft ON ft.id = f.fabric_type_id
       LEFT JOIN program.neighborhoods n ON n.id = f.neighborhood_id
       WHERE f.id = $1 AND f.organization_id = $2 AND f.deleted_at IS NULL`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('بافت یافت نشد');
    return { featureType: 'fabric', ...rows[0] };
  }
}
