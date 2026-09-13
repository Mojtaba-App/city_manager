import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserGeoScope } from '../entities/user-geo-scope.entity';
import { JwtPayload, SystemRole } from '@city-manager/shared';
import { AbacService } from './abac.service';
import { User } from '../../users/entities/user.entity';

/**
 * Row-level access: organization + optional neighborhood/zone scope.
 */
@Injectable()
export class RowLevelAccessService {
  constructor(
    @InjectRepository(UserGeoScope)
    private readonly geoRepo: Repository<UserGeoScope>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly abac: AbacService,
  ) {}

  isSuperAdmin(user: JwtPayload): boolean {
    return user.roles.includes(SystemRole.SUPER_ADMIN);
  }

  /** Effective org scope for queries (null = all orgs for super_admin) */
  orgScope(user: JwtPayload): string | null {
    return this.isSuperAdmin(user) ? null : user.orgId;
  }

  async getNeighborhoodScope(userId: string): Promise<string[] | null> {
    const scopes = await this.geoRepo.find({ where: { userId } });
    const ids = scopes.map((s) => s.neighborhoodId).filter(Boolean) as string[];
    return ids.length ? ids : null; // null = unrestricted within org
  }

  async applyHouseholdFilters(
    user: JwtPayload,
    alias: string,
  ): Promise<{ sql: string; params: Record<string, unknown> } | null> {
    const parts: string[] = [];
    const params: Record<string, unknown> = {};

    const orgId = this.orgScope(user);
    if (orgId) {
      parts.push(`${alias}.organization_id = :rlsOrgId`);
      params.rlsOrgId = orgId;
    }

    const neighborhoods = await this.getNeighborhoodScope(user.sub);
    if (neighborhoods) {
      parts.push(`${alias}.neighborhood_id IN (:...rlsNeighborhoods)`);
      params.rlsNeighborhoods = neighborhoods;
    }

    if (!parts.length) return null;
    return { sql: parts.join(' AND '), params };
  }

  canAccessOrgResource(user: JwtPayload, resourceOrgId?: string | null): boolean {
    return this.abac.assertOrgAccess(
      user.orgId,
      resourceOrgId,
      this.isSuperAdmin(user),
    );
  }

  private async assertUserInOrg(userId: string, organizationId: string) {
    const target = await this.userRepo.findOne({ where: { id: userId } });
    if (!target) throw new BadRequestException('کاربر یافت نشد');
    if (target.organizationId && target.organizationId !== organizationId) {
      throw new ForbiddenException('محدوده جغرافیایی فقط برای کاربران همان سازمان قابل تنظیم است');
    }
  }

  async listGeoScopes(userId: string, organizationId: string) {
    await this.assertUserInOrg(userId, organizationId);
    return this.geoRepo.find({ where: { userId, organizationId } });
  }

  async setGeoScopes(
    userId: string,
    organizationId: string,
    scopes: Array<{ neighborhoodId?: string; zoneId?: string }>,
  ) {
    await this.assertUserInOrg(userId, organizationId);
    await this.geoRepo.delete({ userId, organizationId });
    if (!scopes.length) return [];
    const rows = scopes.map((s) =>
      this.geoRepo.create({
        userId,
        organizationId,
        neighborhoodId: s.neighborhoodId ?? null,
        zoneId: s.zoneId ?? null,
      }),
    );
    return this.geoRepo.save(rows);
  }
}
