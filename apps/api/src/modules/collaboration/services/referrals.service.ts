import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { AgencyReferral } from '../entities/agency-referral.entity';
import { Agency } from '../../case/entities/agency.entity';
import { Household } from '../../case/entities/household.entity';
import { ConsentsService } from './consents.service';
import { NotificationsService } from './notifications.service';
import { AttachReferralConsentDto, CreateReferralDto, UpdateReferralStatusDto } from '../dto/collaboration.dto';
import {
  ApiResponse,
  ConsentPurpose,
  isMunicipalDistrict,
  municipalReferralDestinationCode,
  municipalReferralDestinationLabel,
  normalizeReferralScopes,
  NotificationType,
  ReferralDataScope,
  ReferralDestinationKind,
  ReferralStatus,
} from '@city-manager/shared';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(AgencyReferral)
    private readonly repo: Repository<AgencyReferral>,
    @InjectRepository(Agency)
    private readonly agencies: Repository<Agency>,
    @InjectRepository(Household)
    private readonly households: Repository<Household>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly consents: ConsentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    orgId: string,
    filters?: { householdId?: string; status?: string; destinationKind?: string },
  ): Promise<ApiResponse<AgencyReferral[]>> {
    const qb = this.repo.createQueryBuilder('r')
      .where('r.organization_id = :orgId', { orgId })
      .andWhere('r.deleted_at IS NULL')
      .orderBy('r.created_at', 'DESC')
      .take(100);
    if (filters?.householdId) qb.andWhere('r.household_id = :hh', { hh: filters.householdId });
    if (filters?.status) qb.andWhere('r.status = :st', { st: filters.status });
    if (filters?.destinationKind) qb.andWhere('r.destination_kind = :dk', { dk: filters.destinationKind });
    return { success: true, data: await qb.getMany() };
  }

  /**
   * Inbox for future partner / municipal-unit access.
   * Today usable by staff with filters; later bound to audience_organization_id + access_enabled.
   */
  async listInbox(
    orgId: string,
    filters: {
      audienceOrganizationId?: string;
      municipalDistrict?: number;
      destinationCode?: string;
      includeDisabled?: boolean;
    },
  ): Promise<ApiResponse<AgencyReferral[]>> {
    const qb = this.repo.createQueryBuilder('r')
      .where('r.deleted_at IS NULL')
      .andWhere('r.status IN (:...statuses)', {
        statuses: [
          ReferralStatus.SENT,
          ReferralStatus.ACCEPTED,
          ReferralStatus.REJECTED,
        ],
      })
      .orderBy('r.sent_at', 'DESC')
      .take(100);

    if (filters.audienceOrganizationId) {
      qb.andWhere('r.audience_organization_id = :aud', { aud: filters.audienceOrganizationId });
    } else {
      // Staff inbox within owning org until audience orgs are provisioned
      qb.andWhere('r.organization_id = :orgId', { orgId });
    }
    if (filters.municipalDistrict != null) {
      qb.andWhere('r.destination_kind = :dk', { dk: ReferralDestinationKind.MUNICIPAL_DISTRICT });
      qb.andWhere('r.municipal_district = :md', { md: filters.municipalDistrict });
    }
    if (filters.destinationCode) {
      qb.andWhere('r.destination_code = :dc', { dc: filters.destinationCode });
    }
    if (!filters.includeDisabled) {
      qb.andWhere('(r.access_enabled = true OR r.organization_id = :orgId)', { orgId });
    }
    return { success: true, data: await qb.getMany() };
  }

  async findOne(orgId: string, id: string): Promise<ApiResponse<AgencyReferral>> {
    return { success: true, data: await this.require(orgId, id) };
  }

  async create(orgId: string, userId: string, dto: CreateReferralDto): Promise<ApiResponse<AgencyReferral>> {
    const hh = await this.households.findOne({
      where: { id: dto.householdId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!hh) throw new NotFoundException('پرونده خانوار یافت نشد');

    const scopeFields = normalizeReferralScopes(dto.scopeFields);
    const destination = await this.resolveDestination(orgId, dto);

    let consentId = dto.consentId;
    if (!consentId && dto.createConsent) {
      const created = await this.consents.create(orgId, userId, {
        householdId: dto.householdId,
        purpose: ConsentPurpose.AGENCY_REFERRAL,
        scopeFields,
        grantNow: true,
        grantedByName: dto.grantedByName || 'سرپرست خانوار',
        notes: `رضایت خودکار برای ارجاع: ${dto.title.trim()}`,
      });
      consentId = created.data?.id;
    }

    let status: string = ReferralStatus.DRAFT;
    if (consentId) {
      await this.consents.requireValid(orgId, consentId, dto.householdId, scopeFields);
      status = ReferralStatus.READY;
    } else {
      status = ReferralStatus.PENDING_CONSENT;
    }

    const row = this.repo.create({
      organizationId: orgId,
      householdId: dto.householdId,
      agencyId: destination.agencyId,
      destinationKind: destination.destinationKind,
      municipalDistrict: destination.municipalDistrict,
      destinationCode: destination.destinationCode,
      destinationLabel: destination.destinationLabel,
      audienceOrganizationId: destination.audienceOrganizationId,
      accessEnabled: false,
      consentId,
      title: dto.title.trim(),
      notes: dto.notes?.trim(),
      scopeFields,
      status,
      createdBy: userId,
    });
    const data = await this.repo.save(row);

    if (userId) {
      await this.notifications.notify({
        organizationId: orgId,
        userId,
        type: NotificationType.REFERRAL_CREATED,
        title: `ارجاع «${data.title}» ثبت شد`,
        body: `مقصد: ${destination.destinationLabel}`,
        link: `/dashboard/referrals`,
        metadata: {
          referralId: data.id,
          householdId: dto.householdId,
          destinationKind: destination.destinationKind,
        },
      });
    }

    return { success: true, data };
  }

  async attachConsent(
    orgId: string,
    id: string,
    dto: AttachReferralConsentDto,
  ): Promise<ApiResponse<AgencyReferral>> {
    const row = await this.require(orgId, id);
    if (![ReferralStatus.DRAFT, ReferralStatus.PENDING_CONSENT, ReferralStatus.READY].includes(row.status as ReferralStatus)) {
      throw new BadRequestException('در این وضعیت نمی‌توان رضایت را متصل کرد');
    }
    await this.consents.requireValid(orgId, dto.consentId, row.householdId, row.scopeFields);
    row.consentId = dto.consentId;
    row.status = ReferralStatus.READY;
    return { success: true, data: await this.repo.save(row) };
  }

  async send(orgId: string, userId: string, id: string): Promise<ApiResponse<AgencyReferral>> {
    const row = await this.require(orgId, id);
    if (!row.consentId) {
      throw new BadRequestException('ارسال بدون رضایت ممنوع است');
    }
    await this.consents.requireValid(orgId, row.consentId, row.householdId, row.scopeFields);

    if (!['ready', 'pending_consent', 'draft'].includes(row.status)) {
      throw new BadRequestException('وضعیت ارجاع برای ارسال معتبر نیست');
    }

    row.payloadSnapshot = await this.buildMinimizedPayload(orgId, row);
    row.status = ReferralStatus.SENT;
    row.sentAt = new Date();
    // Enable inbox visibility for destination once partner access is provisioned later.
    row.accessEnabled = Boolean(row.audienceOrganizationId) || row.destinationKind === ReferralDestinationKind.MUNICIPAL_DISTRICT;
    const data = await this.repo.save(row);

    await this.notifications.notify({
      organizationId: orgId,
      userId,
      type: NotificationType.REFERRAL_STATUS,
      title: `ارجاع «${data.title}» ارسال شد`,
      body: data.destinationLabel || undefined,
      link: `/dashboard/referrals`,
      metadata: { referralId: data.id, destinationKind: data.destinationKind },
    });

    return { success: true, data };
  }

  async updateStatus(
    orgId: string,
    userId: string,
    id: string,
    dto: UpdateReferralStatusDto,
  ): Promise<ApiResponse<AgencyReferral>> {
    const row = await this.require(orgId, id);
    const allowed = Object.values(ReferralStatus) as string[];
    if (!allowed.includes(dto.status)) throw new BadRequestException('وضعیت نامعتبر');
    row.status = dto.status;
    if (dto.responseNotes !== undefined) row.responseNotes = dto.responseNotes.trim();
    if (dto.externalReference !== undefined) row.externalReference = dto.externalReference.trim();
    if ([ReferralStatus.ACCEPTED, ReferralStatus.REJECTED].includes(dto.status as ReferralStatus)) {
      row.respondedAt = new Date();
    }
    const data = await this.repo.save(row);
    await this.notifications.notify({
      organizationId: orgId,
      userId,
      type: NotificationType.REFERRAL_STATUS,
      title: `وضعیت ارجاع «${data.title}» به‌روز شد`,
      body: dto.status,
      link: `/dashboard/referrals`,
      metadata: { referralId: data.id },
    });
    return { success: true, data };
  }

  async cancel(orgId: string, id: string): Promise<ApiResponse<AgencyReferral>> {
    const row = await this.require(orgId, id);
    row.status = ReferralStatus.CANCELLED;
    return { success: true, data: await this.repo.save(row) };
  }

  private async resolveDestination(orgId: string, dto: CreateReferralDto): Promise<{
    destinationKind: string;
    agencyId?: string;
    municipalDistrict?: number;
    destinationCode: string;
    destinationLabel: string;
    audienceOrganizationId?: string;
  }> {
    const kind = (dto.destinationKind || ReferralDestinationKind.PARTNER_AGENCY) as ReferralDestinationKind;

    if (kind === ReferralDestinationKind.MUNICIPAL_DISTRICT) {
      if (!isMunicipalDistrict(dto.municipalDistrict)) {
        throw new BadRequestException('منطقه شهرداری باید بین ۱ تا ۸ باشد');
      }
      const district = Number(dto.municipalDistrict);
      return {
        destinationKind: ReferralDestinationKind.MUNICIPAL_DISTRICT,
        municipalDistrict: district,
        destinationCode: municipalReferralDestinationCode(district),
        destinationLabel: municipalReferralDestinationLabel(district),
      };
    }

    if (!dto.agencyId) {
      throw new BadRequestException('ارگان همکار را انتخاب کنید');
    }
    const agency = await this.agencies.findOne({
      where: { id: dto.agencyId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!agency) throw new NotFoundException('ارگان یافت نشد');

    const meta = (agency as { metadata?: Record<string, unknown> }).metadata;
    const audienceOrganizationId = typeof meta?.audienceOrganizationId === 'string'
      ? meta.audienceOrganizationId
      : undefined;

    return {
      destinationKind: ReferralDestinationKind.PARTNER_AGENCY,
      agencyId: agency.id,
      destinationCode: agency.code || agency.id,
      destinationLabel: agency.name,
      audienceOrganizationId,
    };
  }

  private async buildMinimizedPayload(
    orgId: string,
    row: AgencyReferral,
  ): Promise<Record<string, unknown>> {
    const [hh] = await this.dataSource.query(
      `SELECT h.id, h.case_number, h.status, h.member_count, h.vulnerability_score,
              h.vulnerability_level, n.name AS neighborhood_name, n.municipal_district AS nbhd_district,
              d.district, d.city
       FROM "case".households h
       LEFT JOIN program.neighborhoods n ON n.id = h.neighborhood_id
       LEFT JOIN "case".dwellings d ON d.id = h.dwelling_id
       WHERE h.id = $1 AND h.organization_id = $2 AND h.deleted_at IS NULL`,
      [row.householdId, orgId],
    );
    if (!hh) throw new NotFoundException('پرونده یافت نشد');

    const payload: Record<string, unknown> = {
      referralId: row.id,
      purpose: row.purpose,
      generatedAt: new Date().toISOString(),
      destination: {
        kind: row.destinationKind,
        code: row.destinationCode,
        label: row.destinationLabel,
        municipalDistrict: row.municipalDistrict ?? null,
        agencyId: row.agencyId ?? null,
        accessEnabled: row.accessEnabled,
      },
      dataMinimization: true,
      scopes: row.scopeFields,
    };
    const scopes = new Set(row.scopeFields as ReferralDataScope[]);

    if (scopes.has('case_summary')) {
      payload.caseSummary = {
        caseNumber: hh.case_number,
        status: hh.status,
      };
    }
    if (scopes.has('member_count')) {
      payload.memberCount = hh.member_count;
    }
    if (scopes.has('vulnerability')) {
      payload.vulnerability = {
        score: hh.vulnerability_score,
        level: hh.vulnerability_level,
      };
    }
    if (scopes.has('address_district')) {
      payload.location = {
        neighborhood: hh.neighborhood_name,
        municipalDistrict: hh.nbhd_district ?? row.municipalDistrict ?? null,
        district: hh.district,
        city: hh.city,
      };
    }
    if (scopes.has('contact_phone')) {
      // عمداً شماره کامل برنمی‌گردد — فقط وجود کانال تماس
      payload.contactAvailable = true;
    }
    if (scopes.has('support_history')) {
      const supports = await this.dataSource.query(
        `SELECT sp.name, a.status, a.assigned_at
         FROM "case".household_support_assignments a
         JOIN "case".support_packages sp ON sp.id = a.package_id
         WHERE a.household_id = $1 AND a.organization_id = $2
         ORDER BY a.assigned_at DESC LIMIT 10`,
        [row.householdId, orgId],
      ).catch(() => []);
      payload.supportHistory = supports;
    }

    return payload;
  }

  private async require(orgId: string, id: string): Promise<AgencyReferral> {
    const row = await this.repo.findOne({
      where: { id, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!row) throw new NotFoundException('ارجاع یافت نشد');
    return row;
  }
}
