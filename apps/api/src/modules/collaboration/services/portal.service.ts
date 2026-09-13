import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PortalInvite } from '../entities/portal-invite.entity';
import { Household } from '../../case/entities/household.entity';
import { HouseholdDocument } from '../../case/entities/household-document.entity';
import { DataConsent } from '../entities/data-consent.entity';
import { CreatePortalInviteDto } from '../dto/collaboration.dto';
import {
  ApiResponse,
  JwtPayload,
  Permission,
  PortalHouseholdSummary,
  PortalInviteStatus,
  ConsentPurpose,
  ConsentStatus,
} from '@city-manager/shared';
import { ObjectStorageService } from '../../storage/object-storage.service';
import {
  HOUSEHOLD_DOC_ALLOWED_TYPES,
  HOUSEHOLD_DOC_MAX_FILE_SIZE,
} from '../../case/services/household-documents.service';

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

function generateInviteCode(): string {
  const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

@Injectable()
export class PortalService {
  constructor(
    @InjectRepository(PortalInvite)
    private readonly invites: Repository<PortalInvite>,
    @InjectRepository(Household)
    private readonly households: Repository<Household>,
    @InjectRepository(HouseholdDocument)
    private readonly documents: Repository<HouseholdDocument>,
    @InjectRepository(DataConsent)
    private readonly consents: Repository<DataConsent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly storage: ObjectStorageService,
  ) {}

  async createInvite(
    orgId: string,
    userId: string,
    dto: CreatePortalInviteDto,
  ): Promise<ApiResponse<{ invite: PortalInvite; inviteCode: string }>> {
    const hh = await this.households.findOne({
      where: { id: dto.householdId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!hh) throw new NotFoundException('پرونده خانوار یافت نشد');

    const inviteCode = generateInviteCode();
    const days = dto.expiresInDays ?? 14;
    const row = this.invites.create({
      organizationId: orgId,
      householdId: dto.householdId,
      inviteCodeHash: hashCode(inviteCode),
      inviteCodeHint: inviteCode.slice(-4),
      status: PortalInviteStatus.PENDING,
      recipientName: dto.recipientName?.trim(),
      recipientPhone: dto.recipientPhone?.trim(),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      createdBy: userId,
    });
    const invite = await this.invites.save(row);
    return { success: true, data: { invite, inviteCode } };
  }

  async listInvites(orgId: string, householdId?: string): Promise<ApiResponse<PortalInvite[]>> {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (householdId) where.householdId = householdId;
    const data = await this.invites.find({ where, order: { createdAt: 'DESC' }, take: 50 });
    return { success: true, data };
  }

  async revokeInvite(orgId: string, id: string): Promise<ApiResponse<PortalInvite>> {
    const row = await this.invites.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('دعوت‌نامه یافت نشد');
    row.status = PortalInviteStatus.REVOKED;
    row.revokedAt = new Date();
    return { success: true, data: await this.invites.save(row) };
  }

  async redeem(inviteCode: string): Promise<ApiResponse<{ accessToken: string; summary: PortalHouseholdSummary }>> {
    const invite = await this.invites.findOne({ where: { inviteCodeHash: hashCode(inviteCode) } });
    if (!invite) throw new UnauthorizedException('کد دعوت نامعتبر است');
    if (invite.status === PortalInviteStatus.REVOKED) {
      throw new UnauthorizedException('دعوت‌نامه لغو شده است');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      invite.status = PortalInviteStatus.EXPIRED;
      await this.invites.save(invite);
      throw new UnauthorizedException('دعوت‌نامه منقضی شده است');
    }

    invite.status = PortalInviteStatus.ACTIVE;
    invite.activatedAt = invite.activatedAt ?? new Date();
    invite.lastAccessAt = new Date();
    await this.invites.save(invite);

    const summary = await this.buildSummary(invite.organizationId, invite.householdId);
    const payload: JwtPayload = {
      sub: `portal:${invite.id}`,
      email: `portal+${invite.id}@local`,
      orgId: invite.organizationId,
      roles: [],
      permissions: [Permission.PORTAL_ACCESS, Permission.DOCUMENTS_WRITE, Permission.DOCUMENTS_READ, Permission.CONSENTS_READ, Permission.CONSENTS_WRITE],
      householdId: invite.householdId,
      portal: true,
    };
    const accessToken = this.jwt.sign(payload, { expiresIn: '12h' });
    return { success: true, data: { accessToken, summary } };
  }

  async getSummary(user: JwtPayload): Promise<ApiResponse<PortalHouseholdSummary>> {
    this.assertPortal(user);
    const summary = await this.buildSummary(user.orgId!, user.householdId!);
    return { success: true, data: summary };
  }

  async listDocuments(user: JwtPayload): Promise<ApiResponse<HouseholdDocument[]>> {
    this.assertPortal(user);
    const data = await this.documents.find({
      where: {
        organizationId: user.orgId!,
        householdId: user.householdId!,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return { success: true, data };
  }

  async uploadDocument(
    user: JwtPayload,
    file: Express.Multer.File,
    title?: string,
    category?: string,
  ): Promise<ApiResponse<HouseholdDocument>> {
    this.assertPortal(user);
    if (!file) throw new BadRequestException('فایل الزامی است');
    if (file.size > HOUSEHOLD_DOC_MAX_FILE_SIZE) {
      throw new BadRequestException('حداکثر حجم فایل ۱۵ مگابایت است');
    }
    const contentType = file.mimetype || 'application/octet-stream';
    if (!HOUSEHOLD_DOC_ALLOWED_TYPES.has(contentType)) {
      throw new BadRequestException('نوع فایل مجاز نیست (PDF، تصویر یا Word)');
    }
    const safeName = file.originalname.replace(/[^\w.\-آ-ی()+\s]/gi, '_').slice(0, 200);
    const key = `${user.orgId}/portal/${user.householdId}/${Date.now()}-${safeName}`;
    await this.storage.putObject(key, file.buffer, contentType);
    const doc = this.documents.create({
      organizationId: user.orgId!,
      householdId: user.householdId!,
      title: title?.trim() || safeName,
      category: category?.trim() || 'portal_upload',
      fileName: safeName,
      contentType,
      fileSize: String(file.size),
      storageKey: key,
    });
    return { success: true, data: await this.documents.save(doc) };
  }

  async listConsents(user: JwtPayload): Promise<ApiResponse<DataConsent[]>> {
    this.assertPortal(user);
    const data = await this.consents.find({
      where: {
        organizationId: user.orgId!,
        householdId: user.householdId!,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    return { success: true, data };
  }

  async grantConsent(user: JwtPayload, consentId: string, grantedByName?: string): Promise<ApiResponse<DataConsent>> {
    this.assertPortal(user);
    const row = await this.consents.findOne({
      where: {
        id: consentId,
        organizationId: user.orgId!,
        householdId: user.householdId!,
        deletedAt: IsNull(),
      },
    });
    if (!row) throw new NotFoundException('رضایت یافت نشد');
    row.status = ConsentStatus.GRANTED;
    row.grantedAt = new Date();
    row.grantedByName = grantedByName?.trim() || 'سرپرست خانوار (پورتال)';
    return { success: true, data: await this.consents.save(row) };
  }

  async revokeConsent(user: JwtPayload, consentId: string): Promise<ApiResponse<DataConsent>> {
    this.assertPortal(user);
    const row = await this.consents.findOne({
      where: {
        id: consentId,
        organizationId: user.orgId!,
        householdId: user.householdId!,
        deletedAt: IsNull(),
      },
    });
    if (!row) throw new NotFoundException('رضایت یافت نشد');
    row.status = ConsentStatus.REVOKED;
    row.revokedAt = new Date();
    return { success: true, data: await this.consents.save(row) };
  }

  async downloadDocument(user: JwtPayload, documentId: string) {
    this.assertPortal(user);
    const doc = await this.documents.findOne({
      where: {
        id: documentId,
        organizationId: user.orgId!,
        householdId: user.householdId!,
        deletedAt: IsNull(),
      },
    });
    if (!doc) throw new NotFoundException('سند یافت نشد');
    const buffer = await this.storage.getObjectBuffer(doc.storageKey);
    return { doc, buffer };
  }

  async requestPortalConsent(user: JwtPayload): Promise<ApiResponse<DataConsent>> {
    this.assertPortal(user);
    const row = this.consents.create({
      organizationId: user.orgId!,
      householdId: user.householdId!,
      purpose: ConsentPurpose.PORTAL_ACCESS,
      status: ConsentStatus.GRANTED,
      scopeFields: ['case_summary', 'document_upload'],
      grantedByName: 'سرپرست خانوار (پورتال)',
      grantedAt: new Date(),
      createdBy: undefined,
    });
    return { success: true, data: await this.consents.save(row) };
  }

  private assertPortal(user: JwtPayload) {
    if (!user.portal || !user.householdId || !user.orgId) {
      throw new UnauthorizedException('دسترسی پورتال معتبر نیست');
    }
  }

  private async buildSummary(orgId: string, householdId: string): Promise<PortalHouseholdSummary> {
    const [row] = await this.dataSource.query(
      `SELECT h.case_number, h.status, h.member_count, h.notes,
              n.name AS neighborhood_name, d.district, d.city, d.street
       FROM "case".households h
       LEFT JOIN program.neighborhoods n ON n.id = h.neighborhood_id
       LEFT JOIN "case".dwellings d ON d.id = h.dwelling_id
       WHERE h.id = $1 AND h.organization_id = $2 AND h.deleted_at IS NULL`,
      [householdId, orgId],
    );
    if (!row) throw new NotFoundException('پرونده یافت نشد');
    const addressParts = [row.city, row.district, row.street].filter(Boolean);
    return {
      caseNumber: row.case_number,
      status: row.status,
      memberCount: Number(row.member_count ?? 0),
      neighborhoodName: row.neighborhood_name ?? undefined,
      addressHint: addressParts.length ? addressParts.join('، ') : undefined,
      notesPublic: undefined,
    };
  }
}
