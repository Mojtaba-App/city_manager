import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { RegenerationProgram } from '../entities/regeneration-program.entity';
import { ApiResponse, RegenerationProgramStatus } from '@city-manager/shared';

export interface CreateProgramInput {
  code: string;
  name: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  budgetTotal?: number;
  isActive?: boolean;
}

export type UpdateProgramInput = Partial<CreateProgramInput>;

@Injectable()
export class RegenerationProgramsService {
  constructor(
    @InjectRepository(RegenerationProgram)
    private readonly repo: Repository<RegenerationProgram>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findAll(orgId: string): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    const programs = await this.repo.find({
      where: { organizationId: orgId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    const enriched = await Promise.all(programs.map(async (p) => {
      const [nb] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM program.neighborhoods
         WHERE program_id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [p.id, orgId],
      );
      const [pj] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM program.area_projects
         WHERE program_id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [p.id, orgId],
      );
      const [hh] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM "case".households h
         JOIN program.neighborhoods n ON n.id = h.neighborhood_id
         WHERE n.program_id = $1 AND h.organization_id = $2 AND h.deleted_at IS NULL`,
        [p.id, orgId],
      );
      return {
        ...p,
        neighborhoodCount: nb?.c ?? 0,
        projectCount: pj?.c ?? 0,
        householdCount: hh?.c ?? 0,
      };
    }));

    return { success: true, data: enriched };
  }

  async findOne(orgId: string, id: string): Promise<ApiResponse<Record<string, unknown>>> {
    const p = await this.require(orgId, id);
    const neighborhoods = await this.dataSource.query(
      `SELECT id, code, name, status, area_sqm FROM program.neighborhoods
       WHERE program_id = $1 AND organization_id = $2 AND deleted_at IS NULL ORDER BY name`,
      [id, orgId],
    );
    const projects = await this.dataSource.query(
      `SELECT id, name, status, progress_percent, amount, target_type, target_id
       FROM program.area_projects
       WHERE program_id = $1 AND organization_id = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [id, orgId],
    );
    return { success: true, data: { ...p, neighborhoods, projects } };
  }

  async create(orgId: string, dto: CreateProgramInput): Promise<ApiResponse<RegenerationProgram>> {
    const code = dto.code.trim();
    const exists = await this.repo.findOne({ where: { organizationId: orgId, code, deletedAt: IsNull() } });
    if (exists) throw new BadRequestException('کد برنامه تکراری است');

    const entity = this.repo.create({
      organizationId: orgId,
      code,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      status: dto.status ?? RegenerationProgramStatus.ACTIVE,
      startDate: dto.startDate || undefined,
      endDate: dto.endDate || undefined,
      budgetTotal: dto.budgetTotal != null ? String(Math.round(dto.budgetTotal)) : undefined,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(entity);
    return { success: true, data: saved };
  }

  async update(orgId: string, id: string, dto: UpdateProgramInput): Promise<ApiResponse<RegenerationProgram>> {
    const row = await this.require(orgId, id);
    if (dto.code !== undefined) {
      const code = dto.code.trim();
      const clash = await this.repo.findOne({ where: { organizationId: orgId, code, deletedAt: IsNull() } });
      if (clash && clash.id !== id) throw new BadRequestException('کد برنامه تکراری است');
      row.code = code;
    }
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.description !== undefined) row.description = dto.description?.trim();
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.startDate !== undefined) row.startDate = dto.startDate || undefined;
    if (dto.endDate !== undefined) row.endDate = dto.endDate || undefined;
    if (dto.budgetTotal !== undefined) {
      row.budgetTotal = dto.budgetTotal != null ? String(Math.round(dto.budgetTotal)) : undefined;
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    const saved = await this.repo.save(row);
    return { success: true, data: saved };
  }

  async softDelete(orgId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    const row = await this.require(orgId, id);
    await this.repo.softRemove(row);
    return { success: true, data: { id } };
  }

  private async require(orgId: string, id: string): Promise<RegenerationProgram> {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!row) throw new NotFoundException('برنامه بازآفرینی یافت نشد');
    return row;
  }
}
