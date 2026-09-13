import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { OwnershipRecord } from '../entities/ownership-record.entity';
import { InsuranceRecord } from '../entities/insurance-record.entity';
import { Agency } from '../entities/agency.entity';
import { FormDefinition } from '../entities/form-definition.entity';
import { CreateOwnershipDto, CreateInsuranceDto, CreateAgencyDto, UpsertFormDefinitionDto } from '../dto/case.dto';
import { PiiCryptoService } from './pii-crypto.service';
import { ChangeLogService } from './change-log.service';
import { ApiResponse, CaseEntityType, FormDefinitionSchema, normalizeOwnershipType, validateFormDefinitionSchema } from '@city-manager/shared';

@Injectable()
export class OwnershipService {
  constructor(
    @InjectRepository(OwnershipRecord)
    private readonly repo: Repository<OwnershipRecord>,
    private readonly changeLog: ChangeLogService,
  ) {}

  async create(orgId: string, userId: string, dwellingId: string, dto: CreateOwnershipDto, householdId?: string) {
    await this.repo.update({ dwellingId, isCurrent: true }, { isCurrent: false });
    const saved = await this.repo.save(
      this.repo.create({
        dwellingId,
        householdId,
        ownershipType: normalizeOwnershipType(dto.ownershipType) ?? dto.ownershipType,
        ownerName: dto.ownerName,
        leaseStartDate: dto.leaseStartDate,
        leaseEndDate: dto.leaseEndDate,
        monthlyRent: dto.monthlyRent,
        documentReference: dto.documentReference,
        notes: dto.notes,
        recordedBy: userId,
        isCurrent: true,
      }),
    );
    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.OWNERSHIP,
      entityId: saved.id,
      action: 'create',
      changedBy: userId,
      newValues: { ...saved } as unknown as Record<string, unknown>,
    });
    return { success: true, data: saved };
  }
}

@Injectable()
export class InsuranceService {
  constructor(
    @InjectRepository(InsuranceRecord)
    private readonly repo: Repository<InsuranceRecord>,
    private readonly pii: PiiCryptoService,
    private readonly changeLog: ChangeLogService,
  ) {}

  async findByHousehold(householdId: string) {
    const data = await this.repo.find({ where: { householdId }, order: { createdAt: 'DESC' } });
    return { success: true, data };
  }

  async create(orgId: string, userId: string, householdId: string, dto: CreateInsuranceDto) {
    const saved = await this.repo.save(
      this.repo.create({
        householdId,
        memberId: dto.memberId,
        agencyId: dto.agencyId,
        insuranceType: dto.insuranceType,
        policyNumberEnc: dto.policyNumber ? this.pii.encrypt(dto.policyNumber) : undefined,
        coverageStart: dto.coverageStart,
        coverageEnd: dto.coverageEnd,
      }),
    );
    await this.changeLog.log({
      organizationId: orgId,
      entityType: CaseEntityType.INSURANCE,
      entityId: saved.id,
      action: 'create',
      changedBy: userId,
      newValues: { insuranceType: dto.insuranceType },
    });
    return { success: true, data: saved };
  }
}

@Injectable()
export class AgenciesService {
  constructor(@InjectRepository(Agency) private readonly repo: Repository<Agency>) {}

  async findAll(orgId: string) {
    const data = await this.repo.find({ where: { organizationId: orgId, isActive: true, deletedAt: IsNull() } });
    return { success: true, data };
  }

  async create(orgId: string, dto: CreateAgencyDto) {
    const data = await this.repo.save(this.repo.create({ organizationId: orgId, ...dto }));
    return { success: true, data };
  }
}

const DEFAULT_FORMS: Record<string, FormDefinitionSchema> = {
  member: {
    sections: [{ id: 'custom', title: 'فیلدهای تکمیلی' }],
    fields: [
      { key: 'disabilityType', label: 'نوع معلولیت', type: 'select', section: 'custom', options: [
        { value: 'none', label: 'ندارد' }, { value: 'physical', label: 'جسمی' }, { value: 'mental', label: 'ذهنی' },
      ]},
    ],
  },
  household: {
    sections: [{ id: 'custom', title: 'اطلاعات تکمیلی خانوار' }],
    fields: [
      { key: 'vulnerabilityScore', label: 'امتیاز آسیب‌پذیری', type: 'number', section: 'custom' },
    ],
  },
};

@Injectable()
export class FormsService {
  constructor(@InjectRepository(FormDefinition) private readonly repo: Repository<FormDefinition>) {}

  async getForm(orgId: string, entityType: string): Promise<ApiResponse<FormDefinitionSchema>> {
    const db = await this.repo.findOne({
      where: { organizationId: orgId, entityType, isActive: true },
      order: { version: 'DESC' },
    });
    const schema = (db?.schema as unknown as FormDefinitionSchema) ?? DEFAULT_FORMS[entityType] ?? { sections: [], fields: [] };
    return { success: true, data: schema };
  }

  async listAll(orgId: string) {
    const rows = await this.repo.find({
      where: { organizationId: orgId, isActive: true },
      order: { entityType: 'ASC', version: 'DESC' },
    });
    const seen = new Set<string>();
    const latest = rows.filter((r) => {
      if (seen.has(r.entityType)) return false;
      seen.add(r.entityType);
      return true;
    });
    return { success: true, data: latest };
  }

  async upsert(orgId: string, dto: UpsertFormDefinitionDto) {
    if (!Object.values(CaseEntityType).includes(dto.entityType as CaseEntityType)) {
      return { success: false, error: { code: 'VALIDATION', message: 'نوع موجودیت نامعتبر است' } };
    }
    const schemaErrors = validateFormDefinitionSchema(dto.schema);
    if (schemaErrors.length) {
      return { success: false, error: { code: 'VALIDATION', message: schemaErrors[0] } };
    }
    const latest = await this.repo.findOne({
      where: { organizationId: orgId, entityType: dto.entityType },
      order: { version: 'DESC' },
    });
    const version = (latest?.version ?? 0) + 1;
    await this.repo.update({ organizationId: orgId, entityType: dto.entityType }, { isActive: false });
    const data = await this.repo.save(
      this.repo.create({
        organizationId: orgId,
        entityType: dto.entityType,
        name: dto.name,
        schema: dto.schema,
        version,
        isActive: true,
      }),
    );
    return { success: true, data };
  }
}
