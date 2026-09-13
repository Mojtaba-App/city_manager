import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Household } from '../entities/household.entity';
import { HouseholdStatusHistory } from '../entities/household-status-history.entity';
import { Dwelling } from '../entities/dwelling.entity';
import { CreateHouseholdDto, UpdateHouseholdDto } from '../dto/case.dto';
import { ChangeLogService } from './change-log.service';
import {
  ApiResponse,
  CaseEntityType,
  HouseholdStatus,
  JwtPayload,
  canCreateHouseholdWithStatus,
  householdStatusTransitionError,
} from '@city-manager/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { RowLevelAccessService } from '../../security/services/row-level-access.service';

@Injectable()
export class HouseholdsService {
  constructor(
    @InjectRepository(Household)
    private readonly repo: Repository<Household>,
    @InjectRepository(HouseholdStatusHistory)
    private readonly statusHistoryRepo: Repository<HouseholdStatusHistory>,
    @InjectRepository(Dwelling)
    private readonly dwellingRepo: Repository<Dwelling>,
    private readonly changeLog: ChangeLogService,
    private readonly rls: RowLevelAccessService,
  ) {}

  async findAll(
    orgId: string,
    query: PaginationQueryDto,
    user?: JwtPayload,
  ): Promise<ApiResponse<Household[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Apply geo-scope when the caller passes their JWT payload.
    if (user) {
      const neighborhoods = await this.rls.getNeighborhoodScope(user.sub);
      if (neighborhoods) {
        // User is restricted to specific neighborhoods — use IN filter.
        const [items, total] = await this.repo.findAndCount({
          where: { organizationId: orgId, deletedAt: IsNull(), neighborhoodId: In(neighborhoods) },
          order: { createdAt: 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
        });
        return { success: true, data: items, meta: { page, limit, total } };
      }
    }

    const [items, total] = await this.repo.findAndCount({
      where: { organizationId: orgId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { success: true, data: items, meta: { page, limit, total } };
  }

  async findOne(orgId: string, id: string): Promise<ApiResponse<unknown>> {
    const household = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!household) throw new NotFoundException('خانوار یافت نشد');

    const dwelling = await this.dwellingRepo.findOne({ where: { id: household.dwellingId } });
    let dwellingWithGeo = dwelling;
    if (dwelling) {
      const geo = await this.dwellingRepo.manager.query(
        `SELECT ST_AsGeoJSON(location)::json AS geometry FROM "case".dwellings WHERE id = $1`,
        [dwelling.id],
      );
      dwellingWithGeo = { ...dwelling, geometry: geo[0]?.geometry ?? null } as typeof dwelling & { geometry?: unknown };
    }

    const statusHistory = await this.statusHistoryRepo.find({
      where: { householdId: id },
      order: { changedAt: 'DESC' },
      take: 20,
    });

    return { success: true, data: { household, dwelling: dwellingWithGeo, statusHistory } };
  }

  async create(orgId: string, userId: string, dto: CreateHouseholdDto): Promise<ApiResponse<Household>> {
    const dwelling = await this.dwellingRepo.findOne({
      where: { id: dto.dwellingId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!dwelling) throw new BadRequestException('ملک نامعتبر است');

    const initialStatus = dto.status ?? HouseholdStatus.DRAFT;
    if (!canCreateHouseholdWithStatus(initialStatus)) {
      throw new BadRequestException('وضعیت اولیه پرونده فقط پیش‌نویس یا فعال مجاز است');
    }

    const entity = this.repo.create({
      organizationId: orgId,
      dwellingId: dto.dwellingId,
      neighborhoodId: dto.neighborhoodId ?? dwelling.neighborhoodId,
      caseNumber: dto.caseNumber,
      status: initialStatus,
      registeredAt: dto.registeredAt ?? new Date().toISOString().slice(0, 10),
      notes: dto.notes,
      customFields: dto.customFields ?? {},
      createdBy: userId,
      assignedUserId: dto.assignedUserId,
    });

    const saved = await this.repo.save(entity);

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.HOUSEHOLD,
      entityId: saved.id,
      action: 'create',
      changedBy: userId,
      newValues: { ...saved } as unknown as Record<string, unknown>,
    });

    return { success: true, data: saved };
  }

  async update(orgId: string, userId: string, id: string, dto: UpdateHouseholdDto): Promise<ApiResponse<Household>> {
    const existing = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!existing) throw new NotFoundException('خانوار یافت نشد');

    // Optimistic lock: if caller supplied expectedVersion and it doesn't match
    // the DB row, someone else saved first — return 409 so the UI can reload.
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new ConflictException(
        'پرونده توسط کاربر دیگری ویرایش شده است. لطفاً صفحه را مجدداً بارگذاری کنید.',
      );
    }

    const oldValues = { ...existing };

    if (dto.status && dto.status !== existing.status) {
      const transitionError = householdStatusTransitionError(existing.status, dto.status);
      if (transitionError) throw new BadRequestException(transitionError);
      if (!dto.statusChangeReason) {
        throw new BadRequestException('علت تغییر وضعیت الزامی است');
      }
      await this.statusHistoryRepo.save({
        householdId: id,
        fromStatus: existing.status,
        toStatus: dto.status,
        reason: dto.statusChangeReason,
        changedBy: userId,
      });
      existing.status = dto.status;
    }

    if (dto.notes !== undefined) existing.notes = dto.notes;
    if (dto.customFields !== undefined) existing.customFields = dto.customFields;
    existing.version += 1;

    const saved = await this.repo.save(existing);

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.HOUSEHOLD,
      entityId: id,
      action: 'update',
      changedBy: userId,
      oldValues: oldValues as unknown as Record<string, unknown>,
      newValues: { ...saved } as unknown as Record<string, unknown>,
    });

    return { success: true, data: saved };
  }

  async softDelete(orgId: string, userId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    const existing = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!existing) throw new NotFoundException('خانوار یافت نشد');

    await this.repo.softRemove(existing);

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.HOUSEHOLD,
      entityId: id,
      action: 'delete',
      changedBy: userId,
      oldValues: { caseNumber: existing.caseNumber, status: existing.status },
    });

    return { success: true, data: { id } };
  }

  async getHistory(entityType: string, entityId: string) {
    return this.changeLog.findEnrichedByEntity(entityType, entityId);
  }

  async findByDwelling(orgId: string, dwellingId: string): Promise<ApiResponse<Household | null>> {
    const household = await this.repo.findOne({
      where: { organizationId: orgId, dwellingId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return { success: true, data: household };
  }
}
