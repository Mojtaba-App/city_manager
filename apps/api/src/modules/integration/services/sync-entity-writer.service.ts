import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Household } from '../../case/entities/household.entity';
import { FamilyMember } from '../../case/entities/family-member.entity';
import { Dwelling } from '../../case/entities/dwelling.entity';
import { ExternalIdMapping } from '../entities/external-id-mapping.entity';
import {
  HouseholdStatus,
  IntegrationTargetEntity,
  MemberRole,
  normalizeOwnershipType,
} from '@city-manager/shared';

export type SyncWriteResult = {
  internalId: string;
  created: boolean;
  entityType: string;
};

@Injectable()
export class SyncEntityWriterService {
  constructor(
    @InjectRepository(Household) private readonly households: Repository<Household>,
    @InjectRepository(FamilyMember) private readonly members: Repository<FamilyMember>,
    @InjectRepository(Dwelling) private readonly dwellings: Repository<Dwelling>,
    @InjectRepository(ExternalIdMapping) private readonly extRepo: Repository<ExternalIdMapping>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async writeMapped(
    orgId: string,
    connectorId: string,
    entityType: string,
    externalId: string,
    mapped: Record<string, unknown>,
  ): Promise<SyncWriteResult | null> {
    const type = entityType.trim().toLowerCase();
    if (type === IntegrationTargetEntity.HOUSEHOLD || type === 'household') {
      return this.upsertHousehold(orgId, connectorId, externalId, mapped);
    }
    if (type === IntegrationTargetEntity.MEMBER || type === 'member') {
      return this.upsertMember(orgId, connectorId, externalId, mapped);
    }
    if (type === IntegrationTargetEntity.DWELLING || type === 'dwelling') {
      return this.upsertDwelling(orgId, connectorId, externalId, mapped);
    }
    return null;
  }

  private async upsertHousehold(
    orgId: string,
    connectorId: string,
    externalId: string,
    mapped: Record<string, unknown>,
  ): Promise<SyncWriteResult> {
    const existing = await this.extRepo.findOne({
      where: { connectorId, entityType: 'household', externalId },
    });
    if (existing?.internalId) {
      const hh = await this.households.findOne({
        where: { id: existing.internalId, organizationId: orgId, deletedAt: IsNull() },
      });
      if (hh) {
        if (mapped.status != null) hh.status = String(mapped.status);
        if (mapped.notes != null) hh.notes = String(mapped.notes);
        if (mapped.neighborhoodId != null) hh.neighborhoodId = String(mapped.neighborhoodId);
        if (mapped.caseNumber != null) hh.caseNumber = String(mapped.caseNumber).slice(0, 100);
        await this.households.save(hh);
        return { internalId: hh.id, created: false, entityType: 'household' };
      }
    }

    const dwellingId = await this.resolveDwellingId(orgId, connectorId, mapped);
    const caseNumber = String(mapped.caseNumber ?? mapped.code ?? externalId).slice(0, 100);
    const status = String(mapped.status ?? HouseholdStatus.DRAFT);
    const entity = this.households.create({
      organizationId: orgId,
      dwellingId,
      caseNumber,
      status,
      registeredAt: String(mapped.registeredAt ?? new Date().toISOString().slice(0, 10)),
      neighborhoodId: mapped.neighborhoodId ? String(mapped.neighborhoodId) : undefined,
      notes: mapped.notes != null ? String(mapped.notes) : undefined,
      customFields: {
        ...(typeof mapped.customFields === 'object' && mapped.customFields
          ? (mapped.customFields as Record<string, unknown>)
          : {}),
        externalId,
        ownershipType: normalizeOwnershipType(mapped.ownershipType) ?? undefined,
      },
    });
    const saved = await this.households.save(entity);
    await this.linkExternal(connectorId, 'household', externalId, saved.id, mapped);
    return { internalId: saved.id, created: true, entityType: 'household' };
  }

  private async upsertMember(
    orgId: string,
    connectorId: string,
    externalId: string,
    mapped: Record<string, unknown>,
  ): Promise<SyncWriteResult> {
    const householdId = await this.resolveHouseholdId(orgId, connectorId, mapped);
    if (!householdId) {
      throw new Error('برای همگام‌سازی عضو، householdId یا householdExternalId الزامی است');
    }

    const existing = await this.extRepo.findOne({
      where: { connectorId, entityType: 'member', externalId },
    });
    const role = String(mapped.memberRole ?? mapped.role ?? MemberRole.OTHER);
    const firstName = String(mapped.firstName ?? mapped.name ?? 'نامشخص').slice(0, 100);
    const lastName = String(mapped.lastName ?? '').slice(0, 100);

    if (existing?.internalId) {
      const member = await this.members.findOne({
        where: { id: existing.internalId, organizationId: orgId, deletedAt: IsNull() },
      });
      if (member) {
        member.firstName = firstName;
        member.lastName = lastName || member.lastName;
        member.memberRole = role;
        if (mapped.gender != null) member.gender = String(mapped.gender);
        if (mapped.birthDate != null) member.birthDate = String(mapped.birthDate);
        if (mapped.employmentStatus != null) member.employmentStatus = String(mapped.employmentStatus);
        await this.members.save(member);
        if (role === MemberRole.HEAD) {
          await this.households.update(householdId, { headMemberId: member.id });
        }
        return { internalId: member.id, created: false, entityType: 'member' };
      }
    }

    const entity = this.members.create({
      organizationId: orgId,
      householdId,
      memberRole: role,
      firstName,
      lastName: lastName || '—',
      gender: String(mapped.gender ?? 'unknown'),
      birthDate: mapped.birthDate ? String(mapped.birthDate) : undefined,
      employmentStatus: mapped.employmentStatus ? String(mapped.employmentStatus) : undefined,
      customFields: { externalId },
    });
    const saved = await this.members.save(entity);
    await this.households.increment({ id: householdId }, 'memberCount', 1);
    if (role === MemberRole.HEAD) {
      await this.households.update(householdId, { headMemberId: saved.id });
    }
    await this.linkExternal(connectorId, 'member', externalId, saved.id, mapped);
    return { internalId: saved.id, created: true, entityType: 'member' };
  }

  private async upsertDwelling(
    orgId: string,
    connectorId: string,
    externalId: string,
    mapped: Record<string, unknown>,
  ): Promise<SyncWriteResult> {
    const existing = await this.extRepo.findOne({
      where: { connectorId, entityType: 'dwelling', externalId },
    });
    const code = String(mapped.dwellingCode ?? mapped.code ?? externalId).slice(0, 100);
    const title = String(mapped.title ?? mapped.name ?? code).slice(0, 300);

    if (existing?.internalId) {
      await this.dwellings.update(
        { id: existing.internalId, organizationId: orgId },
        {
          dwellingCode: code,
          title,
          fullAddress: mapped.fullAddress != null ? String(mapped.fullAddress) : undefined,
        },
      );
      return { internalId: existing.internalId, created: false, entityType: 'dwelling' };
    }

    const rows = await this.dataSource.query(
      `INSERT INTO "case".dwellings
        (organization_id, dwelling_code, title, full_address, neighborhood_id, building_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [
        orgId,
        code,
        title,
        mapped.fullAddress != null ? String(mapped.fullAddress) : null,
        mapped.neighborhoodId ? String(mapped.neighborhoodId) : null,
        mapped.buildingType != null ? String(mapped.buildingType) : null,
      ],
    );
    const id = rows[0].id as string;
    await this.linkExternal(connectorId, 'dwelling', externalId, id, mapped);
    return { internalId: id, created: true, entityType: 'dwelling' };
  }

  private async resolveDwellingId(
    orgId: string,
    connectorId: string,
    mapped: Record<string, unknown>,
  ): Promise<string> {
    if (mapped.dwellingId) {
      const d = await this.dwellings.findOne({
        where: { id: String(mapped.dwellingId), organizationId: orgId, deletedAt: IsNull() },
      });
      if (d) return d.id;
    }
    if (mapped.dwellingExternalId) {
      const ext = await this.extRepo.findOne({
        where: {
          connectorId,
          entityType: 'dwelling',
          externalId: String(mapped.dwellingExternalId),
        },
      });
      if (ext?.internalId) return ext.internalId;
    }
    if (mapped.dwellingCode) {
      const d = await this.dwellings.findOne({
        where: {
          organizationId: orgId,
          dwellingCode: String(mapped.dwellingCode),
          deletedAt: IsNull(),
        },
      });
      if (d) return d.id;
    }
    const created = await this.upsertDwelling(
      orgId,
      connectorId,
      String(mapped.dwellingExternalId ?? mapped.dwellingCode ?? `auto-${Date.now()}`),
      mapped,
    );
    return created.internalId;
  }

  private async resolveHouseholdId(
    orgId: string,
    connectorId: string,
    mapped: Record<string, unknown>,
  ): Promise<string | null> {
    if (mapped.householdId) {
      const h = await this.households.findOne({
        where: { id: String(mapped.householdId), organizationId: orgId, deletedAt: IsNull() },
      });
      if (h) return h.id;
    }
    if (mapped.householdExternalId) {
      const ext = await this.extRepo.findOne({
        where: {
          connectorId,
          entityType: 'household',
          externalId: String(mapped.householdExternalId),
        },
      });
      if (ext?.internalId) return ext.internalId;
    }
    if (mapped.caseNumber) {
      const h = await this.households.findOne({
        where: {
          organizationId: orgId,
          caseNumber: String(mapped.caseNumber),
          deletedAt: IsNull(),
        },
      });
      if (h) return h.id;
    }
    return null;
  }

  private async linkExternal(
    connectorId: string,
    entityType: string,
    externalId: string,
    internalId: string,
    mapped: Record<string, unknown>,
  ) {
    const existing = await this.extRepo.findOne({
      where: { connectorId, entityType, externalId },
    });
    if (existing) {
      existing.internalId = internalId;
      existing.lastPayload = mapped;
      existing.lastSyncedAt = new Date();
      await this.extRepo.save(existing);
      return;
    }
    await this.extRepo.save(
      this.extRepo.create({
        connectorId,
        entityType,
        externalId,
        internalId,
        lastPayload: mapped,
      }),
    );
  }
}
