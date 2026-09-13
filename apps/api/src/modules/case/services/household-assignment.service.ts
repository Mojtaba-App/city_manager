import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Household } from '../entities/household.entity';
import { ApiResponse, vulnerabilityLevelRank } from '@city-manager/shared';

@Injectable()
export class HouseholdAssignmentService {
  constructor(
    @InjectRepository(Household)
    private readonly householdRepo: Repository<Household>,
  ) {}

  async assign(orgId: string, householdId: string, assignedUserId: string): Promise<ApiResponse<Household>> {
    const household = await this.requireHousehold(orgId, householdId);
    household.assignedUserId = assignedUserId;
    const saved = await this.householdRepo.save(household);
    return { success: true, data: saved };
  }

  async priorityQueue(orgId: string, limit = 50): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    const items = await this.householdRepo.find({
      where: { organizationId: orgId, deletedAt: IsNull() },
      order: {
        priorityRank: 'DESC',
        vulnerabilityScore: 'DESC',
        createdAt: 'ASC',
      },
      take: limit,
    });

    const ranked = items
      .map((h) => ({
        ...h,
        computedRank: this.computeRank(h),
      }))
      .sort((a, b) => b.computedRank - a.computedRank);

    return { success: true, data: ranked as unknown as Array<Record<string, unknown>> };
  }

  private computeRank(h: Household): number {
    const vuln = Number(h.vulnerabilityScore ?? 0);
    const level = vulnerabilityLevelRank(h.vulnerabilityLevel);
    const statusBoost = h.status === 'draft' ? 10 : h.status === 'active' ? 5 : 0;
    return Math.round(vuln * 0.7 + level * 15 + statusBoost + (h.priorityRank ?? 0));
  }

  async requireHousehold(orgId: string, id: string): Promise<Household> {
    const household = await this.householdRepo.findOne({
      where: { id, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!household) throw new NotFoundException('خانوار یافت نشد');
    return household;
  }
}
