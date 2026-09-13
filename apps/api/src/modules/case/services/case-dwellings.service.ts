import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Dwelling } from '../entities/dwelling.entity';
import { CreateDwellingDto } from '../dto/case.dto';
import { ChangeLogService } from './change-log.service';
import { DwellingFacadeService } from './dwelling-facade.service';
import { ApiResponse, CaseEntityType, DwellingSource } from '@city-manager/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

@Injectable()
export class CaseDwellingsService {
  constructor(
    @InjectRepository(Dwelling)
    private readonly repo: Repository<Dwelling>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly changeLog: ChangeLogService,
    private readonly facade: DwellingFacadeService,
  ) {}

  async findAll(orgId: string, query: PaginationQueryDto): Promise<ApiResponse<unknown[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.repo.findAndCount({
      where: { organizationId: orgId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const withGeo = await Promise.all(
      items.map(async (d) => {
        const geo = await this.dataSource.query(
          `SELECT ST_AsGeoJSON(location)::json AS geometry FROM "case".dwellings WHERE id = $1`,
          [d.id],
        );
        return { ...d, geometry: geo[0]?.geometry ?? null };
      }),
    );

    return { success: true, data: withGeo, meta: { page, limit, total } };
  }

  async findOne(orgId: string, id: string): Promise<ApiResponse<unknown>> {
    const dwelling = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!dwelling) throw new NotFoundException('ملک یافت نشد');

    const geo = await this.dataSource.query(
      `SELECT ST_AsGeoJSON(location)::json AS geometry FROM "case".dwellings WHERE id = $1`,
      [id],
    );
    const ownership = await this.dataSource.query(
      `SELECT * FROM "case".ownership_records WHERE dwelling_id = $1 AND is_current = true ORDER BY recorded_at DESC LIMIT 1`,
      [id],
    );

    return { success: true, data: { ...dwelling, geometry: geo[0]?.geometry, ownership: ownership[0] ?? null } };
  }

  async create(orgId: string, userId: string, dto: CreateDwellingDto): Promise<ApiResponse<Dwelling>> {
    return this.facade.create(orgId, userId, dto, DwellingSource.CASE);
  }

  async update(orgId: string, userId: string, id: string, dto: CreateDwellingDto): Promise<ApiResponse<Dwelling>> {
    const existing = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!existing) throw new NotFoundException('ملک یافت نشد');

    const oldValues = { ...existing };
    Object.assign(existing, {
      neighborhoodId: dto.neighborhoodId ?? existing.neighborhoodId,
      dwellingCode: dto.dwellingCode ?? existing.dwellingCode,
      title: dto.title ?? existing.title,
      province: dto.province ?? existing.province,
      city: dto.city ?? existing.city,
      district: dto.district ?? existing.district,
      street: dto.street ?? existing.street,
      alley: dto.alley ?? existing.alley,
      plaque: dto.plaque ?? existing.plaque,
      unit: dto.unit ?? existing.unit,
      postalCode: dto.postalCode ?? existing.postalCode,
      fullAddress: dto.fullAddress ?? existing.fullAddress,
      areaSqm: dto.areaSqm ?? existing.areaSqm,
      buildingType: dto.buildingType ?? existing.buildingType,
      floorCount: dto.floorCount ?? existing.floorCount,
      unitCount: dto.unitCount ?? existing.unitCount,
      constructionYear: dto.constructionYear ?? existing.constructionYear,
      buildingAgeYears: dto.buildingAgeYears ?? existing.buildingAgeYears,
      landUse: dto.landUse ?? existing.landUse,
      customFields: dto.customFields ?? existing.customFields,
      syncedAt: new Date(),
    });

    const saved = await this.repo.save(existing);

    if (dto.geometry) {
      await this.facade.updateLocation(orgId, userId, id, dto.geometry as Record<string, unknown>);
    }

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.DWELLING,
      entityId: id,
      action: 'update',
      changedBy: userId,
      oldValues: oldValues as unknown as Record<string, unknown>,
      newValues: { ...saved } as unknown as Record<string, unknown>,
    });

    return { success: true, data: saved };
  }
}
