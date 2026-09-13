import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  AbacContext,
  AbacDecision,
  AbacResource,
  AbacSubject,
  SystemRole,
} from '@city-manager/shared';
import { AbacPolicy } from '../entities/abac-policy.entity';
import { UserGeoScope } from '../entities/user-geo-scope.entity';

@Injectable()
export class AbacService implements OnModuleInit {
  private cache: AbacPolicy[] = [];
  private cacheAt = 0;
  private readonly CACHE_MS = 60_000;

  constructor(
    @InjectRepository(AbacPolicy)
    private readonly policyRepo: Repository<AbacPolicy>,
    @InjectRepository(UserGeoScope)
    private readonly geoRepo: Repository<UserGeoScope>,
  ) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  async refreshCache(): Promise<void> {
    this.cache = await this.policyRepo.find({
      where: { isActive: true },
      order: { priority: 'ASC' },
    });
    this.cacheAt = Date.now();
  }

  async buildSubject(
    userId: string,
    orgId: string | null,
    roles: string[],
    permissions: string[],
  ): Promise<AbacSubject> {
    const scopes = await this.geoRepo.find({ where: { userId } });
    return {
      userId,
      orgId,
      roles,
      permissions,
      neighborhoodIds: scopes.map((s) => s.neighborhoodId).filter(Boolean) as string[],
      zoneIds: scopes.map((s) => s.zoneId).filter(Boolean) as string[],
    };
  }

  /**
   * RBAC is checked first by PermissionsGuard.
   * ABAC evaluates attribute conditions (org, geo, ownership, purpose).
   * Deny policies with lower priority number win first.
   */
  async evaluate(
    subject: AbacSubject,
    resource: AbacResource,
    ctx: AbacContext,
  ): Promise<AbacDecision> {
    if (subject.roles.includes(SystemRole.SUPER_ADMIN)) {
      return { allow: true, reason: 'super_admin bypass' };
    }

    const policies = await this.getPolicies(subject.orgId);
    const matched: string[] = [];

    for (const policy of policies) {
      if (!this.resourceMatches(policy.resourceType, resource.type)) continue;
      if (!this.actionMatches(policy.actions, ctx.action)) continue;
      if (!this.conditionMatches(policy.condition, subject, resource, ctx)) continue;

      matched.push(policy.id);
      if (policy.effect === 'deny') {
        return {
          allow: false,
          reason: `denied by policy:${policy.name}`,
          matchedPolicyIds: matched,
        };
      }
      // first matching allow after higher-priority denies → allow
      return {
        allow: true,
        reason: `allowed by policy:${policy.name}`,
        matchedPolicyIds: matched,
      };
    }

    // Default: if org mismatch and resource has org → deny
    if (
      resource.organizationId &&
      subject.orgId &&
      resource.organizationId !== subject.orgId
    ) {
      return { allow: false, reason: 'org isolation default deny' };
    }

    return { allow: true, reason: 'no abac deny; rbac already passed' };
  }

  assertOrgAccess(subjectOrgId: string | null, resourceOrgId?: string | null, isSuperAdmin = false): boolean {
    if (isSuperAdmin) return true;
    if (!resourceOrgId) return true;
    if (!subjectOrgId) return false;
    return subjectOrgId === resourceOrgId;
  }

  /** Row-level WHERE fragment helpers */
  orgFilter(orgId: string | null, isSuperAdmin: boolean): { organizationId?: string } | Record<string, never> {
    if (isSuperAdmin || !orgId) return {};
    return { organizationId: orgId };
  }

  private async getPolicies(orgId: string | null): Promise<AbacPolicy[]> {
    if (Date.now() - this.cacheAt > this.CACHE_MS) {
      await this.refreshCache();
    }
    return this.cache.filter(
      (p) => !p.organizationId || p.organizationId === orgId,
    );
  }

  private resourceMatches(policyType: string, resourceType: string): boolean {
    return policyType === '*' || policyType === resourceType;
  }

  private actionMatches(actions: string[], action: string): boolean {
    return actions.includes('*') || actions.includes(action);
  }

  private conditionMatches(
    condition: Record<string, unknown>,
    subject: AbacSubject,
    resource: AbacResource,
    _ctx: AbacContext,
  ): boolean {
    if (condition.orgMatch) {
      if (
        resource.organizationId &&
        subject.orgId &&
        resource.organizationId !== subject.orgId
      ) {
        // For deny policies with orgMatch: condition is true when mismatch
        // For allow policies: orgMatch means must match
        // Convention: orgMatch=true means "subject.org === resource.org" must hold for allow;
        // for deny policy named org_isolation we treat mismatch as match for deny.
        if (condition.orgMatch === true) {
          // allow path: require match — if mismatch, condition fails
          // deny path callers use same evaluator: if org differs, deny policy's orgMatch
          // is interpreted as "cross-org access attempt"
        }
      }
    }

    // Explicit: requireOrgEquals
    if (condition.requireOrgEquals === true) {
      if (!subject.orgId || !resource.organizationId) return false;
      if (subject.orgId !== resource.organizationId) return false;
    }

    // org_isolation deny: fire when orgs differ
    if (condition.orgMatch === true && !condition.requireOrgEquals && !condition.neighborhoodInScope && !condition.hasPermission) {
      if (!subject.orgId || !resource.organizationId) return false;
      return subject.orgId !== resource.organizationId;
    }

    if (condition.neighborhoodInScope === true) {
      const ids = subject.neighborhoodIds ?? [];
      if (ids.length === 0) return true; // no geo limit = full org
      if (!resource.neighborhoodId) return true;
      if (!ids.includes(resource.neighborhoodId)) return false;
    }

    if (typeof condition.hasPermission === 'string') {
      if (!subject.permissions.includes(condition.hasPermission)) return false;
    }

    if (condition.ownerIsSelf === true) {
      if (!resource.ownerId || resource.ownerId !== subject.userId) return false;
    }

    return true;
  }

  async listPolicies(orgId: string | null) {
    const where = orgId
      ? [{ organizationId: orgId }, { organizationId: IsNull() }]
      : {};
    return this.policyRepo.find({
      where: where as never,
      order: { priority: 'ASC', name: 'ASC' },
    });
  }

  async createPolicy(
    orgId: string | null,
    input: {
      name: string;
      description?: string;
      effect: 'allow' | 'deny';
      priority?: number;
      resourceType: string;
      actions: string[];
      condition?: Record<string, unknown>;
      isActive?: boolean;
    },
  ) {
    const row = await this.policyRepo.save(
      this.policyRepo.create({
        organizationId: orgId,
        name: input.name.trim(),
        description: input.description,
        effect: input.effect,
        priority: input.priority ?? 100,
        resourceType: input.resourceType,
        actions: input.actions?.length ? input.actions : ['*'],
        condition: input.condition ?? {},
        isActive: input.isActive ?? true,
      }),
    );
    await this.refreshCache();
    return row;
  }

  async updatePolicy(
    orgId: string | null,
    id: string,
    input: Partial<{
      name: string;
      description: string;
      effect: 'allow' | 'deny';
      priority: number;
      resourceType: string;
      actions: string[];
      condition: Record<string, unknown>;
      isActive: boolean;
    }>,
  ) {
    const row = await this.policyRepo.findOne({ where: { id } });
    if (!row) return null;
    if (orgId && row.organizationId && row.organizationId !== orgId) return null;
    if (input.name != null) row.name = input.name.trim();
    if (input.description != null) row.description = input.description;
    if (input.effect != null) row.effect = input.effect;
    if (input.priority != null) row.priority = input.priority;
    if (input.resourceType != null) row.resourceType = input.resourceType;
    if (input.actions != null) row.actions = input.actions;
    if (input.condition != null) row.condition = input.condition;
    if (input.isActive != null) row.isActive = input.isActive;
    const saved = await this.policyRepo.save(row);
    await this.refreshCache();
    return saved;
  }

  async deletePolicy(orgId: string | null, id: string) {
    const row = await this.policyRepo.findOne({ where: { id } });
    if (!row) return false;
    if (orgId && row.organizationId && row.organizationId !== orgId) return false;
    await this.policyRepo.remove(row);
    await this.refreshCache();
    return true;
  }
}
