import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ReportSchedule } from '../entities/report-schedule.entity';
import { ApiResponse, ReportScheduleFrequency } from '@city-manager/shared';

export interface CreateReportScheduleInput {
  reportCode: string;
  title: string;
  frequency?: string;
  recipients?: string[];
  isEnabled?: boolean;
}

@Injectable()
export class ReportSchedulesService {
  constructor(
    @InjectRepository(ReportSchedule)
    private readonly repo: Repository<ReportSchedule>,
  ) {}

  async list(orgId: string): Promise<ApiResponse<ReportSchedule[]>> {
    const data = await this.repo.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
    });
    return { success: true, data };
  }

  async create(orgId: string, userId: string, dto: CreateReportScheduleInput): Promise<ApiResponse<ReportSchedule>> {
    const row = this.repo.create({
      organizationId: orgId,
      reportCode: dto.reportCode,
      title: dto.title.trim(),
      frequency: dto.frequency ?? ReportScheduleFrequency.WEEKLY,
      recipients: dto.recipients ?? [],
      isEnabled: dto.isEnabled ?? true,
      nextRunAt: this.computeNextRun(dto.frequency ?? ReportScheduleFrequency.WEEKLY),
      createdBy: userId,
    });
    const saved = await this.repo.save(row);
    return { success: true, data: saved };
  }

  async toggle(orgId: string, id: string, isEnabled: boolean): Promise<ApiResponse<ReportSchedule>> {
    const row = await this.require(orgId, id);
    row.isEnabled = isEnabled;
    if (isEnabled && !row.nextRunAt) row.nextRunAt = this.computeNextRun(row.frequency);
    const saved = await this.repo.save(row);
    return { success: true, data: saved };
  }

  async remove(orgId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    const row = await this.require(orgId, id);
    await this.repo.remove(row);
    return { success: true, data: { id } };
  }

  /** Enabled schedules whose nextRunAt is due (inclusive). */
  async findDue(now = new Date(), limit = 50): Promise<ReportSchedule[]> {
    return this.repo.find({
      where: {
        isEnabled: true,
        nextRunAt: LessThanOrEqual(now),
      },
      order: { nextRunAt: 'ASC' },
      take: limit,
    });
  }

  async markRun(orgId: string, id: string, at = new Date()): Promise<void> {
    const row = await this.require(orgId, id);
    row.lastRunAt = at;
    row.nextRunAt = this.computeNextRun(row.frequency, at);
    await this.repo.save(row);
  }

  /** Public for unit tests and worker diagnostics. */
  computeNextRun(frequency: string, from = new Date()): Date {
    const d = new Date(from.getTime());
    if (frequency === ReportScheduleFrequency.DAILY) d.setDate(d.getDate() + 1);
    else if (frequency === ReportScheduleFrequency.MONTHLY) d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    return d;
  }

  private async require(orgId: string, id: string): Promise<ReportSchedule> {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('زمان‌بندی گزارش یافت نشد');
    return row;
  }
}
