import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Dwelling } from '../entities/dwelling.entity';
import { ChangeLogService } from './change-log.service';
import { ApiResponse, CaseEntityType, DwellingSource } from '@city-manager/shared';

export interface UnifiedDwellingInput {
  neighborhoodId?: string;
  dwellingCode?: string;
  title?: string;
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  alley?: string;
  plaque?: string;
  unit?: string;
  postalCode?: string;
  fullAddress?: string;
  areaSqm?: number;
  buildingType?: string;
  floorCount?: number;
  unitCount?: number;
  constructionYear?: number;
  buildingAgeYears?: number;
  landUse?: string;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  geometry?: Record<string, unknown>;
}

@Injectable()
export class DwellingFacadeService {
  constructor(
    @InjectRepository(Dwelling)
    private readonly repo: Repository<Dwelling>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly changeLog: ChangeLogService,
  ) {}

  async create(
    orgId: string,
    userId: string | undefined,
    dto: UnifiedDwellingInput,
    source: DwellingSource | string = DwellingSource.CASE,
  ): Promise<ApiResponse<Dwelling>> {
    const fullAddress = dto.fullAddress
      ?? [dto.province, dto.city, dto.district, dto.street, dto.plaque].filter(Boolean).join('، ');

    let neighborhoodId = dto.neighborhoodId;
    if (dto.geometry && !neighborhoodId) {
      neighborhoodId = await this.detectNeighborhood(orgId, dto.geometry);
    }

    const entity = this.repo.create({
      organizationId: orgId,
      neighborhoodId,
      dwellingCode: dto.dwellingCode,
      title: dto.title,
      province: dto.province,
      city: dto.city,
      district: dto.district,
      street: dto.street,
      alley: dto.alley,
      plaque: dto.plaque,
      unit: dto.unit,
      postalCode: dto.postalCode,
      fullAddress: fullAddress || undefined,
      areaSqm: dto.areaSqm,
      buildingType: dto.buildingType,
      floorCount: dto.floorCount,
      unitCount: dto.unitCount,
      constructionYear: dto.constructionYear,
      buildingAgeYears: dto.buildingAgeYears,
      landUse: dto.landUse,
      customFields: dto.customFields ?? {},
      metadata: dto.metadata,
      source,
      syncedAt: new Date(),
    });

    const saved = await this.repo.save(entity);
    if (dto.geometry) {
      await this.applyGeometry(saved.id, dto.geometry);
    }

    if (userId) {
      await this.changeLog.log({
        organizationId: orgId,
        entityType: CaseEntityType.DWELLING,
        entityId: saved.id,
        action: 'create',
        changedBy: userId,
        newValues: { ...saved, source } as unknown as Record<string, unknown>,
      });
    }

    return { success: true, data: saved };
  }

  async updateLocation(
    orgId: string,
    userId: string | undefined,
    id: string,
    geometry: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const existing = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!existing) throw new BadRequestException('ملک یافت نشد');

    const neighborhoodId = await this.detectNeighborhood(orgId, geometry);
    await this.applyGeometry(id, geometry);
    existing.neighborhoodId = neighborhoodId ?? existing.neighborhoodId;
    existing.syncedAt = new Date();
    if (existing.source === DwellingSource.CASE && !existing.metadata?.gisTouched) {
      existing.metadata = { ...(existing.metadata ?? {}), gisTouched: true };
    }
    await this.repo.save(existing);

    if (userId) {
      await this.changeLog.log({
        organizationId: orgId,
        entityType: CaseEntityType.DWELLING,
        entityId: id,
        action: 'update_location',
        changedBy: userId,
        newValues: { neighborhoodId: existing.neighborhoodId },
      });
    }

    return { success: true, data: { id, neighborhoodId: existing.neighborhoodId } };
  }

  private async detectNeighborhood(orgId: string, geometry: Record<string, unknown>): Promise<string | undefined> {
    const geoJson = JSON.stringify(geometry);
    const match = await this.dataSource.query(
      `SELECT n.id FROM program.neighborhoods n
       WHERE n.organization_id = $1 AND n.deleted_at IS NULL AND n.boundary IS NOT NULL
         AND ST_Contains(n.boundary, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
       LIMIT 1`,
      [orgId, geoJson],
    );
    return match[0]?.id;
  }

  private async applyGeometry(id: string, geometry: Record<string, unknown>) {
    await this.dataSource.query(
      `UPDATE "case".dwellings SET location = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), updated_at = NOW() WHERE id = $1`,
      [id, JSON.stringify(geometry)],
    );
  }
}
