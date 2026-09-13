import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Dwelling } from '../../case/entities/dwelling.entity';
import { CreateDwellingDto } from '../dto/gis.dto';
import { GeometryService } from './geometry.service';
import { DwellingFacadeService } from '../../case/services/dwelling-facade.service';
import { ApiResponse, DwellingSource } from '@city-manager/shared';

@Injectable()
export class DwellingsService {
  constructor(
    @InjectRepository(Dwelling)
    private readonly repo: Repository<Dwelling>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly geometryService: GeometryService,
    private readonly facade: DwellingFacadeService,
  ) {}

  async findAll(orgId: string, neighborhoodId?: string): Promise<ApiResponse<unknown[]>> {
    const params: unknown[] = [orgId];
    let filter = '';
    if (neighborhoodId) {
      params.push(neighborhoodId);
      filter = ` AND d.neighborhood_id = $${params.length}`;
    }
    const rows = await this.dataSource.query(
      `SELECT d.id, d.dwelling_code, d.title, d.full_address, d.building_type,
              d.neighborhood_id, d.source, (d.location IS NOT NULL) AS has_geometry,
              ST_AsGeoJSON(d.location)::json AS geometry
       FROM "case".dwellings d
       WHERE d.organization_id = $1 AND d.deleted_at IS NULL${filter}`,
      params,
    );
    return { success: true, data: rows };
  }

  async create(orgId: string, dto: CreateDwellingDto, userId?: string): Promise<ApiResponse<unknown>> {
    if (dto.geometry) {
      const geoJson = JSON.stringify(dto.geometry);
      const valid = await this.geometryService.isValidGeometry(geoJson);
      if (!valid) throw new BadRequestException('مختصات نامعتبر است');
    }

    const result = await this.facade.create(orgId, userId, {
      neighborhoodId: dto.neighborhoodId,
      dwellingCode: dto.dwellingCode,
      title: dto.title,
      fullAddress: dto.fullAddress,
      buildingType: dto.buildingType,
      metadata: dto.metadata,
      geometry: dto.geometry as Record<string, unknown> | undefined,
    }, DwellingSource.GIS);

    const row = result.data!;
    return {
      success: true,
      data: {
        id: row.id,
        dwelling_code: row.dwellingCode,
        title: row.title,
        neighborhood_id: row.neighborhoodId,
        has_geometry: Boolean(dto.geometry),
        source: row.source,
      },
    };
  }

  async updateLocation(orgId: string, id: string, geometry: Record<string, unknown>, userId?: string): Promise<ApiResponse<unknown>> {
    const geoJson = JSON.stringify(geometry);
    const valid = await this.geometryService.isValidGeometry(geoJson);
    if (!valid) throw new BadRequestException('مختصات نامعتبر است');

    const result = await this.facade.updateLocation(orgId, userId, id, geometry);
    const dwelling = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!dwelling) throw new NotFoundException('ملک یافت نشد');

    return {
      success: true,
      data: {
        id: dwelling.id,
        dwelling_code: dwelling.dwellingCode,
        title: dwelling.title,
        neighborhood_id: (result.data as { neighborhoodId?: string })?.neighborhoodId ?? dwelling.neighborhoodId,
      },
    };
  }

  async softDelete(orgId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    const rows = await this.dataSource.query(
      `UPDATE "case".dwellings SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('ملک یافت نشد');
    return { success: true, data: { id } };
  }

  async getDetailForPopup(orgId: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT d.*, n.name AS neighborhood_name,
              ST_AsGeoJSON(d.location)::json AS geometry
       FROM "case".dwellings d
       LEFT JOIN program.neighborhoods n ON n.id = d.neighborhood_id
       WHERE d.id = $1 AND d.organization_id = $2 AND d.deleted_at IS NULL`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('ملک یافت نشد');
    return { featureType: 'dwelling', ...rows[0] };
  }
}
