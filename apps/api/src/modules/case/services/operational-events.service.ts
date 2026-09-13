import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CaseTask } from '../entities/case-task.entity';
import { FieldVisit } from '../entities/field-visit.entity';
import { Household } from '../entities/household.entity';
import { FamilyMember } from '../entities/family-member.entity';
import { MessageChannel, NotificationType, OperationalEvent, VULNERABILITY_LEVEL_LABELS } from '@city-manager/shared';
import { MessagingDispatchService } from './messaging-dispatch.service';
import { PiiCryptoService } from './pii-crypto.service';
import { NotificationsService } from '../../collaboration/services/notifications.service';

@Injectable()
export class OperationalEventsService {
  constructor(
    @InjectRepository(Household)
    private readonly householdRepo: Repository<Household>,
    @InjectRepository(FamilyMember)
    private readonly memberRepo: Repository<FamilyMember>,
    private readonly messaging: MessagingDispatchService,
    private readonly pii: PiiCryptoService,
    private readonly notifications: NotificationsService,
  ) {}

  async onHouseholdAssigned(orgId: string, userId: string, householdId: string, assigneeId: string) {
    const ctx = await this.householdContext(orgId, householdId);
    if (ctx.phone) {
      await this.messaging.sendEvent(orgId, userId, {
        householdId,
        event: OperationalEvent.HOUSEHOLD_ASSIGNED,
        channel: MessageChannel.SMS,
        recipient: ctx.phone,
        vars: {
          caseNumber: ctx.caseNumber,
          name: ctx.headName,
          message: `پرونده ${ctx.caseNumber} به مددکار ارجاع شد.`,
        },
      });
    }
    if (assigneeId) {
      await this.notifications.notify({
        organizationId: orgId,
        userId: assigneeId,
        type: NotificationType.HOUSEHOLD_ASSIGNED,
        title: `پرونده ${ctx.caseNumber} به شما ارجاع شد`,
        link: `/dashboard/households/${householdId}`,
        metadata: { householdId },
      });
    }
  }

  async onTaskCreated(orgId: string, userId: string, householdId: string, task: CaseTask) {
    const ctx = await this.householdContext(orgId, householdId);
    if (ctx.phone) {
      await this.messaging.sendEvent(orgId, userId, {
        householdId,
        event: OperationalEvent.TASK_CREATED,
        channel: MessageChannel.SMS,
        recipient: ctx.phone,
        vars: {
          caseNumber: ctx.caseNumber,
          name: ctx.headName,
          message: `وظیفه جدید: ${task.title}`,
        },
      });
    }
    if (task.assignedUserId) {
      await this.notifications.notify({
        organizationId: orgId,
        userId: task.assignedUserId,
        type: NotificationType.TASK_ASSIGNED,
        title: `وظیفه جدید: ${task.title}`,
        body: `پرونده ${ctx.caseNumber}`,
        link: `/dashboard/operations`,
        metadata: { taskId: task.id, householdId },
      });
    }
  }

  async onVisitScheduled(orgId: string, userId: string, householdId: string, visit: FieldVisit) {
    const ctx = await this.householdContext(orgId, householdId);
    if (ctx.phone) {
      const when = visit.scheduledAt.toLocaleString('fa-IR');
      await this.messaging.sendEvent(orgId, userId, {
        householdId,
        event: OperationalEvent.VISIT_SCHEDULED,
        channel: MessageChannel.SMS,
        recipient: ctx.phone,
        vars: {
          caseNumber: ctx.caseNumber,
          name: ctx.headName,
          message: `بازدید میدانی در ${when} برنامه‌ریزی شد.`,
        },
      });
    }
    const assignee = visit.assignedUserId ?? userId;
    if (assignee) {
      const when = visit.scheduledAt.toLocaleString('fa-IR');
      await this.notifications.notify({
        organizationId: orgId,
        userId: assignee,
        type: NotificationType.VISIT_SCHEDULED,
        title: `بازدید میدانی ${when}`,
        body: `پرونده ${ctx.caseNumber}`,
        link: `/dashboard/field`,
        metadata: { visitId: visit.id, householdId },
      });
    }
  }

  async onSupportAssigned(orgId: string, userId: string, householdId: string, packageName: string) {
    const ctx = await this.householdContext(orgId, householdId);
    if (!ctx.phone) return;
    await this.messaging.sendEvent(orgId, userId, {
      householdId,
      event: OperationalEvent.SUPPORT_ASSIGNED,
      channel: MessageChannel.SMS,
      recipient: ctx.phone,
      vars: {
        caseNumber: ctx.caseNumber,
        name: ctx.headName,
        message: `بسته حمایتی «${packageName}» تخصیص یافت.`,
      },
    });
  }

  async onVulnerabilityHigh(
    orgId: string,
    userId: string,
    householdId: string,
    score: number,
    level: string,
  ) {
    const ctx = await this.householdContext(orgId, householdId);
    if (!ctx.phone) return;
    const levelLabel = VULNERABILITY_LEVEL_LABELS[level as keyof typeof VULNERABILITY_LEVEL_LABELS] ?? level;
    await this.messaging.sendEvent(orgId, userId, {
      householdId,
      event: OperationalEvent.VULNERABILITY_HIGH,
      channel: MessageChannel.SMS,
      recipient: ctx.phone,
      vars: {
        caseNumber: ctx.caseNumber,
        name: ctx.headName,
        message: `ارزیابی آسیب‌پذیری: ${levelLabel} (امتیاز ${score})`,
      },
    });
  }

  private async householdContext(orgId: string, householdId: string) {
    const household = await this.householdRepo.findOne({
      where: { id: householdId, organizationId: orgId, deletedAt: IsNull() },
    });
    const caseNumber = household?.caseNumber ?? householdId.slice(0, 8);
    let headName = 'سرپرست';
    let phone = '';

    if (household?.headMemberId) {
      const head = await this.memberRepo.findOne({ where: { id: household.headMemberId } });
      if (head) {
        headName = `${head.firstName} ${head.lastName}`.trim();
        if (head.phoneEnc) {
          try {
            phone = this.pii.decrypt(head.phoneEnc);
          } catch {
            phone = '';
          }
        }
      }
    }

    return { caseNumber, headName, phone };
  }
}
