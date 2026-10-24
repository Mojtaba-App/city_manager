import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FamilyMember } from '../entities/family-member.entity';
import { Household } from '../entities/household.entity';
import { CreateMemberDto } from '../dto/case.dto';
import { PiiCryptoService } from './pii-crypto.service';
import { ChangeLogService } from './change-log.service';
import { ApiResponse, CaseEntityType, MemberRole, Permission } from '@city-manager/shared';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(FamilyMember)
    private readonly repo: Repository<FamilyMember>,
    @InjectRepository(Household)
    private readonly householdRepo: Repository<Household>,
    private readonly pii: PiiCryptoService,
    private readonly changeLog: ChangeLogService,
  ) {}

  async findByHousehold(orgId: string, householdId: string, canReadPii: boolean): Promise<ApiResponse<unknown[]>> {
    await this.assertHousehold(orgId, householdId);
    const members = await this.repo.find({
      where: { householdId, organizationId: orgId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return { success: true, data: members.map((m) => this.toResponse(m, canReadPii)) };
  }

  async create(
    orgId: string,
    userId: string,
    householdId: string,
    dto: CreateMemberDto,
    canWritePii: boolean,
  ): Promise<ApiResponse<unknown> > {
    const household = await this.assertHousehold(orgId, householdId);

    if (dto.memberRole === MemberRole.HEAD && household.headMemberId) {
      const currentHead = await this.repo.findOne({
        where: { id: household.headMemberId, deletedAt: IsNull() },
      });
      if (currentHead) {
        throw new ConflictException('این خانوار هم‌اکنون سرپرست دارد؛ ابتدا نقش سرپرست فعلی را تغییر دهید');
      }
    }

    const entity = this.repo.create({
      organizationId: orgId,
      householdId,
      memberRole: dto.memberRole,
      isBeneficiary: dto.isBeneficiary ?? true,
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender ?? 'unknown',
      birthDate: dto.birthDate,
      fatherName: dto.fatherName,
      motherName: dto.motherName,
      educationLevel: dto.educationLevel,
      educationField: dto.educationField,
      employmentStatus: dto.employmentStatus,
      jobTitle: dto.jobTitle,
      monthlyIncome: dto.monthlyIncome,
      customFields: dto.customFields ?? {},
    });

    if (dto.nationalId && canWritePii) {
      entity.nationalIdEnc = this.pii.encrypt(dto.nationalId);
      entity.nationalIdHash = this.pii.hash(dto.nationalId);
    }
    if (dto.phone && canWritePii) {
      entity.phoneEnc = this.pii.encrypt(dto.phone);
      entity.phoneHash = this.pii.hash(dto.phone);
    }

    const saved = await this.repo.save(entity);

    if (dto.memberRole === MemberRole.HEAD) {
      await this.householdRepo.update(householdId, { headMemberId: saved.id });
    }

    await this.householdRepo.increment({ id: householdId }, 'memberCount', 1);

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.MEMBER,
      entityId: saved.id,
      action: 'create',
      changedBy: userId,
      newValues: this.toResponse(saved, false) as Record<string, unknown>,
    });

    return { success: true, data: this.toResponse(saved, canWritePii) };
  }

  async update(
    orgId: string,
    userId: string,
    householdId: string,
    memberId: string,
    dto: CreateMemberDto,
    canWritePii: boolean,
  ): Promise<ApiResponse<unknown>> {
    const household = await this.assertHousehold(orgId, householdId);
    const existing = await this.repo.findOne({
      where: { id: memberId, householdId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!existing) throw new NotFoundException('عضو یافت نشد');

    const nextRole = dto.memberRole ?? existing.memberRole;
    if (
      nextRole === MemberRole.HEAD
      && household.headMemberId
      && household.headMemberId !== memberId
    ) {
      throw new ConflictException('سرپرست دیگری برای این خانوار ثبت شده است');
    }

    const old = this.toResponse(existing, false);
    const wasHead = existing.memberRole === MemberRole.HEAD || household.headMemberId === memberId;

    Object.assign(existing, {
      memberRole: nextRole,
      firstName: dto.firstName ?? existing.firstName,
      lastName: dto.lastName ?? existing.lastName,
      gender: dto.gender ?? existing.gender,
      birthDate: dto.birthDate ?? existing.birthDate,
      fatherName: dto.fatherName ?? existing.fatherName,
      motherName: dto.motherName ?? existing.motherName,
      educationLevel: dto.educationLevel ?? existing.educationLevel,
      educationField: dto.educationField ?? existing.educationField,
      employmentStatus: dto.employmentStatus ?? existing.employmentStatus,
      jobTitle: dto.jobTitle ?? existing.jobTitle,
      monthlyIncome: dto.monthlyIncome ?? existing.monthlyIncome,
      customFields: dto.customFields ?? existing.customFields,
    });

    if (dto.nationalId && canWritePii) {
      existing.nationalIdEnc = this.pii.encrypt(dto.nationalId);
      existing.nationalIdHash = this.pii.hash(dto.nationalId);
    }
    if (dto.phone && canWritePii) {
      existing.phoneEnc = this.pii.encrypt(dto.phone);
      existing.phoneHash = this.pii.hash(dto.phone);
    }

    const saved = await this.repo.save(existing);

    if (nextRole === MemberRole.HEAD) {
      await this.householdRepo.update(householdId, { headMemberId: saved.id });
    } else if (wasHead) {
      const otherHead = await this.repo.findOne({
        where: {
          householdId,
          organizationId: orgId,
          memberRole: MemberRole.HEAD,
          deletedAt: IsNull(),
        },
      });
      if (!otherHead || otherHead.id === memberId) {
        throw new BadRequestException('نمی‌توان نقش سرپرست را بدون تعیین سرپرست جایگزین حذف کرد');
      }
      await this.householdRepo.update(householdId, { headMemberId: otherHead.id });
    }

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.MEMBER,
      entityId: memberId,
      action: 'update',
      changedBy: userId,
      oldValues: old as Record<string, unknown>,
      newValues: this.toResponse(saved, false) as Record<string, unknown>,
    });

    return { success: true, data: this.toResponse(saved, canWritePii) };
  }

  async softDelete(
    orgId: string,
    userId: string,
    householdId: string,
    memberId: string,
  ): Promise<ApiResponse<{ id: string }>> {
    const household = await this.assertHousehold(orgId, householdId);
    const existing = await this.repo.findOne({
      where: { id: memberId, householdId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!existing) throw new NotFoundException('عضو یافت نشد');

    const isHead = existing.memberRole === MemberRole.HEAD || household.headMemberId === memberId;
    if (isHead) {
      const others = await this.repo.count({
        where: { householdId, organizationId: orgId, deletedAt: IsNull() },
      });
      if (others > 1) {
        throw new BadRequestException(
          'حذف سرپرست مجاز نیست؛ ابتدا سرپرست دیگری تعیین کنید یا سایر اعضا را حذف کنید',
        );
      }
    }

    existing.deletedAt = new Date();
    await this.repo.save(existing);
    await this.householdRepo.decrement({ id: householdId }, 'memberCount', 1);
    if (isHead) {
      await this.householdRepo.manager.query(
        `UPDATE "case".households SET head_member_id = NULL, updated_at = NOW() WHERE id = $1`,
        [householdId],
      );
    }

    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.MEMBER,
      entityId: memberId,
      action: 'soft_delete',
      changedBy: userId,
      oldValues: this.toResponse(existing, false) as Record<string, unknown>,
    });

    return { success: true, data: { id: memberId } };
  }

  private toResponse(member: FamilyMember, includePii: boolean) {
    const age = member.birthDate
      ? Math.floor((Date.now() - new Date(member.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;

    return {
      id: member.id,
      householdId: member.householdId,
      memberRole: member.memberRole,
      firstName: member.firstName,
      lastName: member.lastName,
      gender: member.gender,
      birthDate: member.birthDate,
      age,
      fatherName: member.fatherName,
      motherName: member.motherName,
      educationLevel: member.educationLevel,
      educationField: member.educationField,
      employmentStatus: member.employmentStatus,
      jobTitle: member.jobTitle,
      monthlyIncome: includePii ? member.monthlyIncome : undefined,
      nationalId: includePii && member.nationalIdEnc ? this.pii.decrypt(member.nationalIdEnc) : undefined,
      phone: includePii && member.phoneEnc ? this.pii.decrypt(member.phoneEnc) : undefined,
      customFields: member.customFields,
      createdAt: member.createdAt,
    };
  }

  private async assertHousehold(orgId: string, householdId: string) {
    const h = await this.householdRepo.findOne({
      where: { id: householdId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!h) throw new NotFoundException('خانوار یافت نشد');
    return h;
  }
}

export function hasPiiPermission(permissions: Permission[], write: boolean): boolean {
  return permissions.includes(write ? Permission.MEMBERS_WRITE : Permission.MEMBERS_READ_PII);
}
