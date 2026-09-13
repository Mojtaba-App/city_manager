import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ExpertNote } from '../entities/expert-note.entity';
import { Household } from '../../case/entities/household.entity';
import { CreateExpertNoteDto } from '../dto/trajectory.dto';
import { ChangeLogService } from '../../case/services/change-log.service';
import { CaseEntityType } from '@city-manager/shared';

@Injectable()
export class ExpertNotesService {
  constructor(
    @InjectRepository(ExpertNote)
    private readonly repo: Repository<ExpertNote>,
    @InjectRepository(Household)
    private readonly householdRepo: Repository<Household>,
    private readonly changeLog: ChangeLogService,
  ) {}

  async findByHousehold(orgId: string, householdId: string, memberId?: string) {
    await this.assertHousehold(orgId, householdId);
    const where: Record<string, unknown> = {
      organizationId: orgId,
      householdId,
      deletedAt: IsNull(),
    };
    if (memberId) where.memberId = memberId;

    const data = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return { success: true, data };
  }

  async create(orgId: string, userId: string, householdId: string, dto: CreateExpertNoteDto) {
    await this.assertHousehold(orgId, householdId);

    const saved = await this.repo.save(
      this.repo.create({
        organizationId: orgId,
        householdId,
        memberId: dto.memberId,
        recordId: dto.recordId,
        title: dto.title,
        content: dto.content,
        noteType: dto.noteType ?? 'assessment',
        isConfidential: dto.isConfidential ?? false,
        authorId: userId,
      }),
    );

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.TRAJECTORY,
      entityId: saved.id,
      action: 'expert_note',
      changedBy: userId,
      newValues: { title: saved.title, noteType: saved.noteType },
    });

    return { success: true, data: saved };
  }

  private async assertHousehold(orgId: string, householdId: string) {
    const hh = await this.householdRepo.findOne({ where: { id: householdId, organizationId: orgId } });
    if (!hh) throw new NotFoundException('خانوار یافت نشد');
    return hh;
  }
}
