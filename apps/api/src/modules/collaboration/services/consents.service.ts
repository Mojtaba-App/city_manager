import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DataConsent } from '../entities/data-consent.entity';
import { Household } from '../../case/entities/household.entity';
import { CreateConsentDto, GrantConsentDto } from '../dto/collaboration.dto';
import { ApiResponse, ConsentStatus } from '@city-manager/shared';

@Injectable()
export class ConsentsService {
  constructor(
    @InjectRepository(DataConsent)
    private readonly repo: Repository<DataConsent>,
    @InjectRepository(Household)
    private readonly households: Repository<Household>,
  ) {}

  async listByHousehold(orgId: string, householdId: string): Promise<ApiResponse<DataConsent[]>> {
    await this.requireHousehold(orgId, householdId);
    const data = await this.repo.find({
      where: { organizationId: orgId, householdId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return { success: true, data };
  }

  async create(orgId: string, userId: string, dto: CreateConsentDto): Promise<ApiResponse<DataConsent>> {
    await this.requireHousehold(orgId, dto.householdId);
    const grantNow = Boolean(dto.grantNow);
    const row = this.repo.create({
      organizationId: orgId,
      householdId: dto.householdId,
      purpose: dto.purpose,
      scopeFields: dto.scopeFields ?? [],
      notes: dto.notes?.trim(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      createdBy: userId,
      status: grantNow ? ConsentStatus.GRANTED : ConsentStatus.PENDING,
      grantedByName: grantNow ? (dto.grantedByName?.trim() || 'سرپرست خانوار') : undefined,
      grantedAt: grantNow ? new Date() : undefined,
    });
    const data = await this.repo.save(row);
    return { success: true, data };
  }

  async grant(orgId: string, id: string, dto: GrantConsentDto): Promise<ApiResponse<DataConsent>> {
    const row = await this.require(orgId, id);
    if (row.status === ConsentStatus.REVOKED) {
      throw new BadRequestException('رضایت لغو شده قابل اعطا نیست');
    }
    row.status = ConsentStatus.GRANTED;
    row.grantedAt = new Date();
    row.grantedByName = dto.grantedByName?.trim() || row.grantedByName || 'سرپرست خانوار';
    if (dto.evidenceDocumentId) row.evidenceDocumentId = dto.evidenceDocumentId;
    const data = await this.repo.save(row);
    return { success: true, data };
  }

  async revoke(orgId: string, id: string): Promise<ApiResponse<DataConsent>> {
    const row = await this.require(orgId, id);
    row.status = ConsentStatus.REVOKED;
    row.revokedAt = new Date();
    const data = await this.repo.save(row);
    return { success: true, data };
  }

  async requireValid(
    orgId: string,
    consentId: string,
    householdId: string,
    requiredScopes: string[],
  ): Promise<DataConsent> {
    const consent = await this.require(orgId, consentId);
    if (consent.householdId !== householdId) {
      throw new BadRequestException('رضایت متعلق به این پرونده نیست');
    }
    if (consent.status !== ConsentStatus.GRANTED) {
      throw new BadRequestException('رضایت معتبر اعطا نشده است');
    }
    if (consent.expiresAt && consent.expiresAt.getTime() < Date.now()) {
      consent.status = ConsentStatus.EXPIRED;
      await this.repo.save(consent);
      throw new BadRequestException('رضایت منقضی شده است');
    }
    const missing = requiredScopes.filter((s) => !consent.scopeFields.includes(s));
    if (missing.length) {
      throw new BadRequestException(`دامنه رضایت کافی نیست: ${missing.join(', ')}`);
    }
    return consent;
  }

  private async require(orgId: string, id: string): Promise<DataConsent> {
    const row = await this.repo.findOne({
      where: { id, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!row) throw new NotFoundException('رضایت یافت نشد');
    return row;
  }

  private async requireHousehold(orgId: string, householdId: string) {
    const hh = await this.households.findOne({
      where: { id: householdId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!hh) throw new NotFoundException('پرونده خانوار یافت نشد');
    return hh;
  }
}
