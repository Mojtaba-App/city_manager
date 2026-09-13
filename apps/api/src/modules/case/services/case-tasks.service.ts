import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan, In } from 'typeorm';
import { CaseTask } from '../entities/case-task.entity';
import { CreateCaseTaskDto, UpdateCaseTaskDto } from '../dto/operations.dto';
import { HouseholdAssignmentService } from './household-assignment.service';
import { ApiResponse, CaseTaskStatus } from '@city-manager/shared';
import { OperationalEventsService } from './operational-events.service';

@Injectable()
export class CaseTasksService {
  constructor(
    @InjectRepository(CaseTask)
    private readonly repo: Repository<CaseTask>,
    private readonly households: HouseholdAssignmentService,
    private readonly events: OperationalEventsService,
  ) {}

  async listByHousehold(orgId: string, householdId: string): Promise<ApiResponse<CaseTask[]>> {
    await this.households.requireHousehold(orgId, householdId);
    const items = await this.repo.find({
      where: { organizationId: orgId, householdId, deletedAt: IsNull() },
      order: { dueAt: 'ASC', createdAt: 'DESC' },
    });
    return { success: true, data: items.map((t) => this.withOverdueFlag(t)) };
  }

  async listMine(orgId: string, userId: string, status?: string): Promise<ApiResponse<CaseTask[]>> {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      assignedUserId: userId,
      deletedAt: IsNull(),
    };
    if (status) where.status = status;
    const items = await this.repo.find({ where, order: { dueAt: 'ASC' } });
    return { success: true, data: items.map((t) => this.withOverdueFlag(t)) };
  }

  async listOverdue(orgId: string): Promise<ApiResponse<CaseTask[]>> {
    const now = new Date();
    const items = await this.repo.find({
      where: {
        organizationId: orgId,
        deletedAt: IsNull(),
        status: In([CaseTaskStatus.PENDING, CaseTaskStatus.IN_PROGRESS]),
        dueAt: LessThan(now),
      },
      order: { dueAt: 'ASC' },
    });
    return { success: true, data: items.map((t) => this.withOverdueFlag(t)) };
  }

  async create(
    orgId: string,
    userId: string,
    householdId: string,
    dto: CreateCaseTaskDto,
  ): Promise<ApiResponse<CaseTask>> {
    await this.households.requireHousehold(orgId, householdId);
    const entity = this.repo.create({
      organizationId: orgId,
      householdId,
      title: dto.title.trim(),
      description: dto.description?.trim(),
      taskType: dto.taskType ?? 'general',
      priority: dto.priority ?? 'normal',
      assignedUserId: dto.assignedUserId,
      createdBy: userId,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      checklist: dto.checklist?.map((c) => ({ label: c.label, done: c.done ?? false })) ?? [],
    });
    const saved = await this.repo.save(entity);
    await this.events.onTaskCreated(orgId, userId, householdId, saved);
    return { success: true, data: this.withOverdueFlag(saved) };
  }

  async update(
    orgId: string,
    userId: string,
    householdId: string,
    taskId: string,
    dto: UpdateCaseTaskDto,
  ): Promise<ApiResponse<CaseTask>> {
    const task = await this.requireTask(orgId, householdId, taskId);
    if (dto.title !== undefined) task.title = dto.title.trim();
    if (dto.description !== undefined) task.description = dto.description?.trim();
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.assignedUserId !== undefined) task.assignedUserId = dto.assignedUserId;
    if (dto.dueAt !== undefined) task.dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    if (dto.checklist !== undefined) {
      task.checklist = dto.checklist.map((c) => ({ label: c.label, done: c.done ?? false }));
    }
    if (dto.status !== undefined) {
      task.status = dto.status;
      if (dto.status === CaseTaskStatus.COMPLETED) task.completedAt = new Date();
      if (dto.status === CaseTaskStatus.PENDING || dto.status === CaseTaskStatus.IN_PROGRESS) {
        task.completedAt = undefined;
      }
    }
    const saved = await this.repo.save(task);
    return { success: true, data: this.withOverdueFlag(saved) };
  }

  async softDelete(orgId: string, householdId: string, taskId: string): Promise<ApiResponse<{ id: string }>> {
    const task = await this.requireTask(orgId, householdId, taskId);
    await this.repo.softRemove(task);
    return { success: true, data: { id: taskId } };
  }

  private async requireTask(orgId: string, householdId: string, taskId: string): Promise<CaseTask> {
    const task = await this.repo.findOne({
      where: { id: taskId, organizationId: orgId, householdId, deletedAt: IsNull() },
    });
    if (!task) throw new NotFoundException('وظیفه یافت نشد');
    return task;
  }

  private withOverdueFlag(task: CaseTask): CaseTask & { isOverdue: boolean } {
    const open = task.status === CaseTaskStatus.PENDING || task.status === CaseTaskStatus.IN_PROGRESS;
    const isOverdue = Boolean(open && task.dueAt && task.dueAt.getTime() < Date.now());
    return Object.assign(task, { isOverdue });
  }
}
