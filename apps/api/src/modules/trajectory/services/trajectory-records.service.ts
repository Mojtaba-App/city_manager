import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual, Between } from 'typeorm';
import { LifeTrajectoryRecord } from '../entities/life-trajectory-record.entity';
import { TrajectoryRecordVersion } from '../entities/trajectory-record-version.entity';
import { FamilyMember } from '../../case/entities/family-member.entity';
import { Household } from '../../case/entities/household.entity';
import { ChangeLogService } from '../../case/services/change-log.service';
import { CreateTrajectoryRecordDto, UpdateTrajectoryRecordDto } from '../dto/trajectory.dto';
import {
  CaseEntityType, Permission, LIFE_EVENT_LABELS, LifeEventType,
  TrajectoryTimelineItem, TrajectoryCompareResult, TrajectoryTrendPoint,
} from '@city-manager/shared';

const COMPARE_FIELDS: Array<{ key: keyof LifeTrajectoryRecord; label: string }> = [
  { key: 'jobTitle', label: 'شغل' },
  { key: 'monthlyIncome', label: 'درآمد ماهانه' },
  { key: 'qualityOfLifeScore', label: 'کیفیت زندگی' },
  { key: 'supportStatus', label: 'وضعیت حمایت' },
  { key: 'dwellingAddress', label: 'محل سکونت' },
  { key: 'employmentStatus', label: 'وضعیت اشتغال' },
  { key: 'educationLevel', label: 'تحصیلات' },
];

@Injectable()
export class TrajectoryRecordsService {
  constructor(
    @InjectRepository(LifeTrajectoryRecord)
    private readonly repo: Repository<LifeTrajectoryRecord>,
    @InjectRepository(TrajectoryRecordVersion)
    private readonly versionRepo: Repository<TrajectoryRecordVersion>,
    @InjectRepository(FamilyMember)
    private readonly memberRepo: Repository<FamilyMember>,
    @InjectRepository(Household)
    private readonly householdRepo: Repository<Household>,
    private readonly changeLog: ChangeLogService,
  ) {}

  async findByHousehold(
    orgId: string,
    householdId: string,
    memberId?: string,
    includePii = false,
  ) {
    await this.assertHousehold(orgId, householdId);
    const where: Record<string, unknown> = {
      organizationId: orgId,
      householdId,
      deletedAt: IsNull(),
    };
    if (memberId) where.memberId = memberId;

    const records = await this.repo.find({
      where,
      order: { eventDate: 'DESC', createdAt: 'DESC' },
    });

    const members = await this.memberRepo.find({ where: { householdId, deletedAt: IsNull() } });
    const memberMap = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));

    const timeline = records.map((r) => this.toTimelineItem(r, memberMap, includePii));
    return { success: true, data: timeline };
  }

  async findOne(orgId: string, id: string, includePii = false) {
    const record = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!record) throw new NotFoundException('رویداد یافت نشد');

    const versions = await this.versionRepo.find({
      where: { recordId: id },
      order: { version: 'DESC' },
    });

    const data = includePii ? record : this.redactIncome(record);
    return { success: true, data: { record: data, versions } };
  }

  async create(orgId: string, userId: string, householdId: string, dto: CreateTrajectoryRecordDto) {
    await this.assertHousehold(orgId, householdId);
    if (dto.memberId) await this.assertMember(orgId, householdId, dto.memberId);

    const saved = await this.repo.save(
      this.repo.create({
        organizationId: orgId,
        householdId,
        memberId: dto.memberId,
        recordType: dto.recordType,
        eventType: dto.eventType,
        eventDate: dto.eventDate,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        employmentStatus: dto.employmentStatus,
        jobTitle: dto.jobTitle,
        employerName: dto.employerName,
        previousJobTitle: dto.previousJobTitle,
        monthlyIncome: dto.monthlyIncome,
        previousIncome: dto.previousIncome,
        educationLevel: dto.educationLevel,
        educationField: dto.educationField,
        dwellingId: dto.dwellingId,
        previousDwellingId: dto.previousDwellingId,
        dwellingAddress: dto.dwellingAddress,
        previousDwellingAddress: dto.previousDwellingAddress,
        qualityOfLifeScore: dto.qualityOfLifeScore,
        previousQolScore: dto.previousQolScore,
        qolDimensions: dto.qolDimensions ?? {},
        supportStatus: dto.supportStatus,
        previousSupportStatus: dto.previousSupportStatus,
        supportAgencyId: dto.supportAgencyId,
        description: dto.description,
        recordedBy: userId,
        metadata: dto.metadata ?? {},
      }),
    );

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.TRAJECTORY,
      entityId: saved.id,
      action: 'create',
      changedBy: userId,
      newValues: this.snapshot(saved),
    });

    return { success: true, data: saved };
  }

  async update(orgId: string, userId: string, id: string, dto: UpdateTrajectoryRecordDto) {
    const record = await this.repo.findOne({ where: { id, organizationId: orgId, deletedAt: IsNull() } });
    if (!record) throw new NotFoundException('رویداد یافت نشد');

    const oldSnapshot = this.snapshot(record);

    await this.versionRepo.save(
      this.versionRepo.create({
        recordId: id,
        version: record.version,
        snapshot: oldSnapshot,
        changedBy: userId,
        changeReason: dto.changeReason,
      }),
    );

    Object.assign(record, {
      memberId: dto.memberId ?? record.memberId,
      recordType: dto.recordType ?? record.recordType,
      eventType: dto.eventType ?? record.eventType,
      eventDate: dto.eventDate ?? record.eventDate,
      periodStart: dto.periodStart ?? record.periodStart,
      periodEnd: dto.periodEnd ?? record.periodEnd,
      employmentStatus: dto.employmentStatus ?? record.employmentStatus,
      jobTitle: dto.jobTitle ?? record.jobTitle,
      employerName: dto.employerName ?? record.employerName,
      previousJobTitle: dto.previousJobTitle ?? record.previousJobTitle,
      monthlyIncome: dto.monthlyIncome ?? record.monthlyIncome,
      previousIncome: dto.previousIncome ?? record.previousIncome,
      educationLevel: dto.educationLevel ?? record.educationLevel,
      educationField: dto.educationField ?? record.educationField,
      dwellingId: dto.dwellingId ?? record.dwellingId,
      previousDwellingId: dto.previousDwellingId ?? record.previousDwellingId,
      dwellingAddress: dto.dwellingAddress ?? record.dwellingAddress,
      previousDwellingAddress: dto.previousDwellingAddress ?? record.previousDwellingAddress,
      qualityOfLifeScore: dto.qualityOfLifeScore ?? record.qualityOfLifeScore,
      previousQolScore: dto.previousQolScore ?? record.previousQolScore,
      qolDimensions: dto.qolDimensions ?? record.qolDimensions,
      supportStatus: dto.supportStatus ?? record.supportStatus,
      previousSupportStatus: dto.previousSupportStatus ?? record.previousSupportStatus,
      supportAgencyId: dto.supportAgencyId ?? record.supportAgencyId,
      description: dto.description ?? record.description,
      metadata: dto.metadata ?? record.metadata,
      version: record.version + 1,
    });

    const saved = await this.repo.save(record);

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.TRAJECTORY,
      entityId: saved.id,
      action: 'update',
      changedBy: userId,
      oldValues: oldSnapshot,
      newValues: this.snapshot(saved),
    });

    return { success: true, data: saved };
  }

  async getTrends(orgId: string, householdId: string, memberId?: string, includePii = false) {
    await this.assertHousehold(orgId, householdId);
    const where: Record<string, unknown> = {
      organizationId: orgId,
      householdId,
      deletedAt: IsNull(),
    };
    if (memberId) where.memberId = memberId;

    const records = await this.repo.find({
      where,
      order: { eventDate: 'ASC' },
    });

    const income: TrajectoryTrendPoint[] = [];
    const qol: TrajectoryTrendPoint[] = [];

    for (const r of records) {
      if (r.monthlyIncome != null && includePii) {
        income.push({ date: r.eventDate, income: Number(r.monthlyIncome), label: r.jobTitle });
      }
      if (r.qualityOfLifeScore != null) {
        qol.push({ date: r.eventDate, qualityOfLifeScore: r.qualityOfLifeScore });
      }
    }

    return { success: true, data: { income, qualityOfLife: qol } };
  }

  async compare(
    orgId: string,
    householdId: string,
    fromDate?: string,
    toDate?: string,
    memberId?: string,
    includePii = false,
  ): Promise<{ success: boolean; data: TrajectoryCompareResult }> {
    await this.assertHousehold(orgId, householdId);

    const baselineDate = fromDate ?? new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const currentDate = toDate ?? new Date().toISOString().slice(0, 10);

    const whereBase: Record<string, unknown> = {
      organizationId: orgId,
      householdId,
      deletedAt: IsNull(),
    };
    if (memberId) whereBase.memberId = memberId;

    const baseline = await this.repo.findOne({
      where: { ...whereBase, eventDate: LessThanOrEqual(baselineDate) },
      order: { eventDate: 'DESC' },
    });

    const current = await this.repo.findOne({
      where: { ...whereBase, eventDate: LessThanOrEqual(currentDate) },
      order: { eventDate: 'DESC' },
    });

    const eventsBetween = await this.repo.find({
      where: {
        ...whereBase,
        eventDate: Between(baselineDate, currentDate),
      },
      order: { eventDate: 'ASC' },
    });

    const members = await this.memberRepo.find({ where: { householdId } });
    const memberMap = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));

    const changes = COMPARE_FIELDS.map(({ key, label }) => {
      const before = baseline ? (baseline[key] as unknown) : null;
      let after = current ? (current[key] as unknown) : null;
      if ((key === 'monthlyIncome' || key === 'previousIncome') && !includePii) {
        after = after != null ? '[محرمانه]' : null;
      }
      const b = baseline ? (includePii || key !== 'monthlyIncome' ? before : '[محرمانه]') : null;
      return {
        field: key,
        label,
        before: b,
        after,
        changed: JSON.stringify(b) !== JSON.stringify(after),
      };
    });

    return {
      success: true,
      data: {
        baselineDate,
        currentDate,
        householdId,
        memberId,
        changes,
        eventsBetween: eventsBetween.map((r) => this.toTimelineItem(r, memberMap, includePii)),
      },
    };
  }

  private toTimelineItem(
    r: LifeTrajectoryRecord,
    memberMap: Map<string, string>,
    includePii: boolean,
  ): TrajectoryTimelineItem {
    const eventType = r.eventType as LifeEventType | undefined;
    const title = eventType && LIFE_EVENT_LABELS[eventType]
      ? LIFE_EVENT_LABELS[eventType]
      : r.recordType === 'periodic_assessment' ? 'ارزیابی دوره‌ای' : 'رویداد';

    const parts: string[] = [];
    if (r.jobTitle) parts.push(`شغل: ${r.previousJobTitle ? `${r.previousJobTitle} → ` : ''}${r.jobTitle}`);
    if (r.monthlyIncome != null) {
      parts.push(includePii
        ? `درآمد: ${r.previousIncome != null ? `${r.previousIncome} → ` : ''}${r.monthlyIncome}`
        : 'درآمد: [محرمانه]');
    }
    if (r.dwellingAddress) parts.push(`سکونت: ${r.previousDwellingAddress ? `${r.previousDwellingAddress} → ` : ''}${r.dwellingAddress}`);
    if (r.qualityOfLifeScore != null) {
      parts.push(`کیفیت زندگی: ${r.previousQolScore != null ? `${r.previousQolScore} → ` : ''}${r.qualityOfLifeScore}/10`);
    }
    if (r.supportStatus) parts.push(`حمایت: ${r.previousSupportStatus ?? '—'} → ${r.supportStatus}`);

    return {
      id: r.id,
      recordType: r.recordType as TrajectoryTimelineItem['recordType'],
      eventType,
      eventDate: r.eventDate,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      memberId: r.memberId,
      memberName: r.memberId ? memberMap.get(r.memberId) : undefined,
      title,
      summary: parts.join(' | ') || r.description || '',
      qualityOfLifeScore: r.qualityOfLifeScore,
      supportStatus: r.supportStatus as TrajectoryTimelineItem['supportStatus'],
      createdAt: r.createdAt.toISOString(),
    };
  }

  private snapshot(r: LifeTrajectoryRecord): Record<string, unknown> {
    return {
      recordType: r.recordType,
      eventType: r.eventType,
      eventDate: r.eventDate,
      jobTitle: r.jobTitle,
      monthlyIncome: r.monthlyIncome,
      qualityOfLifeScore: r.qualityOfLifeScore,
      supportStatus: r.supportStatus,
      dwellingAddress: r.dwellingAddress,
      version: r.version,
    };
  }

  private redactIncome(r: LifeTrajectoryRecord): LifeTrajectoryRecord {
    const copy = { ...r };
    if (copy.monthlyIncome != null) copy.monthlyIncome = undefined;
    if (copy.previousIncome != null) copy.previousIncome = undefined;
    return copy;
  }

  private async assertHousehold(orgId: string, householdId: string) {
    const hh = await this.householdRepo.findOne({ where: { id: householdId, organizationId: orgId } });
    if (!hh) throw new NotFoundException('خانوار یافت نشد');
    return hh;
  }

  private async assertMember(orgId: string, householdId: string, memberId: string) {
    const m = await this.memberRepo.findOne({ where: { id: memberId, householdId, organizationId: orgId } });
    if (!m) throw new NotFoundException('عضو یافت نشد');
    return m;
  }
}

export function hasTrajectoryPiiPermission(permissions: Permission[], write = false): boolean {
  if (permissions.includes(Permission.TRAJECTORY_READ_PII)) return true;
  if (write && permissions.includes(Permission.TRAJECTORY_WRITE)) return true;
  return false;
}
