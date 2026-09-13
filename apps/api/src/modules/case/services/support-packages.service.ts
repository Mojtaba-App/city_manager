import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { SupportPackage, HouseholdSupportAssignment } from '../entities/support-package.entity';
import {
  CreateSupportPackageDto, AssignSupportPackageDto, UpdateSupportAssignmentDto,
} from '../dto/operations.dto';
import { HouseholdAssignmentService } from './household-assignment.service';
import { ApiResponse, SupportAssignmentStatus } from '@city-manager/shared';
import { OperationalEventsService } from './operational-events.service';

@Injectable()
export class SupportPackagesService {
  constructor(
    @InjectRepository(SupportPackage)
    private readonly packageRepo: Repository<SupportPackage>,
    @InjectRepository(HouseholdSupportAssignment)
    private readonly assignmentRepo: Repository<HouseholdSupportAssignment>,
    private readonly households: HouseholdAssignmentService,
    private readonly events: OperationalEventsService,
  ) {}

  async listPackages(orgId: string): Promise<ApiResponse<SupportPackage[]>> {
    const items = await this.packageRepo.find({
      where: { organizationId: orgId, deletedAt: IsNull(), isActive: true },
      order: { name: 'ASC' },
    });
    return { success: true, data: items };
  }

  async createPackage(orgId: string, dto: CreateSupportPackageDto): Promise<ApiResponse<SupportPackage>> {
    const exists = await this.packageRepo.findOne({
      where: { organizationId: orgId, code: dto.code.trim(), deletedAt: IsNull() },
    });
    if (exists) throw new BadRequestException('کد بسته تکراری است');

    const entity = this.packageRepo.create({
      organizationId: orgId,
      code: dto.code.trim(),
      name: dto.name.trim(),
      category: dto.category ?? 'other',
      description: dto.description?.trim(),
      budgetAmount: dto.budgetAmount != null ? String(dto.budgetAmount) : undefined,
    });
    const saved = await this.packageRepo.save(entity);
    return { success: true, data: saved };
  }

  async listAssignments(orgId: string, householdId: string): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    await this.households.requireHousehold(orgId, householdId);
    const rows = await this.assignmentRepo.find({
      where: { organizationId: orgId, householdId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const packageIds = [...new Set(rows.map((r) => r.packageId))];
    const packages = packageIds.length
      ? await this.packageRepo.find({ where: { organizationId: orgId, id: In(packageIds) } })
      : [];
    const pkgMap = new Map(packages.map((p) => [p.id, p]));
    return {
      success: true,
      data: rows.map((r) => ({
        ...r,
        package: pkgMap.get(r.packageId) ?? null,
      })),
    };
  }

  async assignPackage(
    orgId: string,
    userId: string,
    householdId: string,
    dto: AssignSupportPackageDto,
  ): Promise<ApiResponse<HouseholdSupportAssignment>> {
    await this.households.requireHousehold(orgId, householdId);
    const pkg = await this.packageRepo.findOne({
      where: { id: dto.packageId, organizationId: orgId, deletedAt: IsNull(), isActive: true },
    });
    if (!pkg) throw new NotFoundException('بسته حمایتی یافت نشد');

    const entity = this.assignmentRepo.create({
      organizationId: orgId,
      householdId,
      packageId: dto.packageId,
      status: SupportAssignmentStatus.PLANNED,
      assignedAt: dto.assignedAt ?? new Date().toISOString().slice(0, 10),
      amount: dto.amount != null ? String(dto.amount) : pkg.budgetAmount,
      outcomeNotes: dto.outcomeNotes?.trim(),
      assignedBy: userId,
    });
    const saved = await this.assignmentRepo.save(entity);
    await this.events.onSupportAssigned(orgId, userId, householdId, pkg.name);
    return { success: true, data: saved };
  }

  async updateAssignment(
    orgId: string,
    householdId: string,
    assignmentId: string,
    dto: UpdateSupportAssignmentDto,
  ): Promise<ApiResponse<HouseholdSupportAssignment>> {
    const row = await this.requireAssignment(orgId, householdId, assignmentId);
    if (dto.status !== undefined) {
      row.status = dto.status;
      if (dto.status === SupportAssignmentStatus.ACTIVE && !row.startedAt) {
        row.startedAt = dto.startedAt ?? new Date().toISOString().slice(0, 10);
      }
      if (dto.status === SupportAssignmentStatus.COMPLETED) {
        row.completedAt = dto.completedAt ?? new Date().toISOString().slice(0, 10);
      }
    }
    if (dto.startedAt !== undefined) row.startedAt = dto.startedAt;
    if (dto.completedAt !== undefined) row.completedAt = dto.completedAt;
    if (dto.outcomeNotes !== undefined) row.outcomeNotes = dto.outcomeNotes?.trim();
    const saved = await this.assignmentRepo.save(row);
    return { success: true, data: saved };
  }

  private async requireAssignment(
    orgId: string,
    householdId: string,
    assignmentId: string,
  ): Promise<HouseholdSupportAssignment> {
    const row = await this.assignmentRepo.findOne({
      where: { id: assignmentId, organizationId: orgId, householdId, deletedAt: IsNull() },
    });
    if (!row) throw new NotFoundException('تخصیص بسته یافت نشد');
    return row;
  }
}
