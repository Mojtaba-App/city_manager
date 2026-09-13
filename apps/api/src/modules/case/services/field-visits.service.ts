import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FieldVisit } from '../entities/field-visit.entity';
import { CreateFieldVisitDto, CompleteFieldVisitDto } from '../dto/operations.dto';
import { HouseholdAssignmentService } from './household-assignment.service';
import { ApiResponse, FieldVisitStatus } from '@city-manager/shared';
import { OperationalEventsService } from './operational-events.service';

@Injectable()
export class FieldVisitsService {
  constructor(
    @InjectRepository(FieldVisit)
    private readonly repo: Repository<FieldVisit>,
    private readonly households: HouseholdAssignmentService,
    private readonly events: OperationalEventsService,
  ) {}

  async listByHousehold(orgId: string, householdId: string): Promise<ApiResponse<FieldVisit[]>> {
    await this.households.requireHousehold(orgId, householdId);
    const items = await this.repo.find({
      where: { organizationId: orgId, householdId, deletedAt: IsNull() },
      order: { scheduledAt: 'DESC' },
    });
    return { success: true, data: items };
  }

  async create(
    orgId: string,
    userId: string,
    householdId: string,
    dto: CreateFieldVisitDto,
  ): Promise<ApiResponse<FieldVisit>> {
    await this.households.requireHousehold(orgId, householdId);
    const entity = this.repo.create({
      organizationId: orgId,
      householdId,
      taskId: dto.taskId,
      assignedUserId: dto.assignedUserId ?? userId,
      scheduledAt: new Date(dto.scheduledAt),
      addressNote: dto.addressNote?.trim(),
      createdBy: userId,
      status: FieldVisitStatus.SCHEDULED,
    });
    const saved = await this.repo.save(entity);
    await this.events.onVisitScheduled(orgId, userId, householdId, saved);
    return { success: true, data: saved };
  }

  async complete(
    orgId: string,
    userId: string,
    householdId: string,
    visitId: string,
    dto: CompleteFieldVisitDto,
  ): Promise<ApiResponse<FieldVisit>> {
    const visit = await this.requireVisit(orgId, householdId, visitId);
    visit.findings = dto.findings?.trim();
    visit.latitude = dto.latitude != null ? String(dto.latitude) : visit.latitude;
    visit.longitude = dto.longitude != null ? String(dto.longitude) : visit.longitude;
    visit.status = dto.status ?? FieldVisitStatus.COMPLETED;
    visit.completedAt = new Date();
    const saved = await this.repo.save(visit);
    return { success: true, data: saved };
  }

  async cancel(orgId: string, householdId: string, visitId: string): Promise<ApiResponse<FieldVisit>> {
    const visit = await this.requireVisit(orgId, householdId, visitId);
    visit.status = FieldVisitStatus.CANCELLED;
    const saved = await this.repo.save(visit);
    return { success: true, data: saved };
  }

  private async requireVisit(orgId: string, householdId: string, visitId: string): Promise<FieldVisit> {
    const visit = await this.repo.findOne({
      where: { id: visitId, organizationId: orgId, householdId, deletedAt: IsNull() },
    });
    if (!visit) throw new NotFoundException('بازدید یافت نشد');
    return visit;
  }
}
