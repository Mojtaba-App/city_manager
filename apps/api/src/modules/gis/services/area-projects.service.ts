import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AreaProject } from '../entities/area-project.entity';
import { CreateAreaProjectDto, UpdateAreaProjectDto } from '../dto/gis.dto';
import { ApiResponse } from '@city-manager/shared';

@Injectable()
export class AreaProjectsService {
  constructor(
    @InjectRepository(AreaProject)
    private readonly repo: Repository<AreaProject>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    orgId: string,
    filters?: { targetType?: string; targetId?: string; programId?: string },
  ): Promise<ApiResponse<AreaProject[]>> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.organization_id = :orgId', { orgId })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.created_at', 'DESC');

    if (filters?.targetType) qb.andWhere('p.target_type = :targetType', { targetType: filters.targetType });
    if (filters?.targetId) qb.andWhere('p.target_id = :targetId', { targetId: filters.targetId });
    if (filters?.programId) qb.andWhere('p.program_id = :programId', { programId: filters.programId });

    const data = await qb.getMany();
    return { success: true, data };
  }

  async findOne(orgId: string, id: string): Promise<ApiResponse<Record<string, unknown>>> {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row || row.deletedAt) throw new NotFoundException('پروژه یافت نشد');
    const impact = await this.computeImpact(orgId, row);
    return { success: true, data: { ...row, impact } };
  }

  async create(orgId: string, dto: CreateAreaProjectDto): Promise<ApiResponse<AreaProject>> {
    if (!['neighborhood', 'fabric'].includes(dto.targetType)) {
      throw new BadRequestException('نوع هدف نامعتبر است');
    }
    const householdsAffected = dto.householdsAffected ?? await this.estimateHouseholds(orgId, dto.targetType, dto.targetId);
    const row = this.repo.create({
      organizationId: orgId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      name: dto.name.trim(),
      projectKind: dto.projectKind ?? 'executive',
      partyRole: dto.partyRole,
      partyName: dto.partyName?.trim(),
      amount: dto.amount != null ? String(Math.round(dto.amount)) : undefined,
      currency: dto.currency ?? 'IRR',
      status: dto.status ?? 'planned',
      contractNumber: dto.contractNumber?.trim(),
      startDate: dto.startDate || undefined,
      endDate: dto.endDate || undefined,
      description: dto.description?.trim(),
      programId: dto.programId,
      contractorName: dto.contractorName?.trim(),
      progressPercent: dto.progressPercent ?? 0,
      budgetSpent: dto.budgetSpent != null ? String(Math.round(dto.budgetSpent)) : undefined,
      householdsAffected,
    });
    const saved = await this.repo.save(row);
    return { success: true, data: saved };
  }

  async update(orgId: string, id: string, dto: UpdateAreaProjectDto): Promise<ApiResponse<AreaProject>> {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row || row.deletedAt) throw new NotFoundException('پروژه یافت نشد');

    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.projectKind !== undefined) row.projectKind = dto.projectKind;
    if (dto.partyRole !== undefined) row.partyRole = dto.partyRole;
    if (dto.partyName !== undefined) row.partyName = dto.partyName.trim();
    if (dto.amount !== undefined) row.amount = String(Math.round(dto.amount));
    if (dto.currency !== undefined) row.currency = dto.currency;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.contractNumber !== undefined) row.contractNumber = dto.contractNumber.trim();
    if (dto.startDate !== undefined) row.startDate = dto.startDate || undefined;
    if (dto.endDate !== undefined) row.endDate = dto.endDate || undefined;
    if (dto.description !== undefined) row.description = dto.description.trim();
    if (dto.programId !== undefined) row.programId = dto.programId || undefined;
    if (dto.contractorName !== undefined) row.contractorName = dto.contractorName?.trim();
    if (dto.progressPercent !== undefined) row.progressPercent = Math.max(0, Math.min(100, dto.progressPercent));
    if (dto.budgetSpent !== undefined) row.budgetSpent = String(Math.round(dto.budgetSpent));
    if (dto.householdsAffected !== undefined) row.householdsAffected = dto.householdsAffected;

    const saved = await this.repo.save(row);
    return { success: true, data: saved };
  }

  async remove(orgId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row || row.deletedAt) throw new NotFoundException('پروژه یافت نشد');
    await this.repo.softRemove(row);
    return { success: true, data: { id } };
  }

  private async estimateHouseholds(orgId: string, targetType: string, targetId: string): Promise<number> {
    if (targetType === 'neighborhood') {
      const [r] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM "case".households
         WHERE organization_id = $1 AND neighborhood_id = $2 AND deleted_at IS NULL`,
        [orgId, targetId],
      );
      return r?.c ?? 0;
    }
    return 0;
  }

  private async computeImpact(orgId: string, project: AreaProject) {
    const householdsInTarget = await this.estimateHouseholds(orgId, project.targetType, project.targetId);
    return {
      householdsInTarget,
      householdsAffected: project.householdsAffected,
      progressPercent: project.progressPercent,
      budgetSpent: project.budgetSpent,
      amount: project.amount,
    };
  }
}
