import { AbacService } from './abac.service';
import { SystemRole } from '@city-manager/shared';
import { AbacPolicy } from '../entities/abac-policy.entity';

describe('AbacService', () => {
  const policies: AbacPolicy[] = [
    {
      id: 'p-deny',
      name: 'org_isolation',
      effect: 'deny',
      priority: 10,
      resourceType: '*',
      actions: ['*'],
      condition: { orgMatch: true },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AbacPolicy,
    {
      id: 'p-geo',
      name: 'geo_scope_household',
      effect: 'allow',
      priority: 50,
      resourceType: 'household',
      actions: ['read', 'write'],
      condition: { requireOrgEquals: true, neighborhoodInScope: true },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AbacPolicy,
  ];

  const policyRepo = {
    find: jest.fn(async () => policies),
  };
  const geoRepo = {
    find: jest.fn(async () => [{ neighborhoodId: 'n1', zoneId: null }]),
  };

  let svc: AbacService;

  beforeEach(() => {
    svc = new AbacService(policyRepo as never, geoRepo as never);
  });

  it('bypasses for super_admin', async () => {
    const d = await svc.evaluate(
      {
        userId: 'u',
        orgId: 'o1',
        roles: [SystemRole.SUPER_ADMIN],
        permissions: [],
      },
      { type: 'household', organizationId: 'other' },
      { action: 'read' },
    );
    expect(d.allow).toBe(true);
    expect(d.reason).toContain('super_admin');
  });

  it('denies cross-org via isolation policy', async () => {
    const d = await svc.evaluate(
      {
        userId: 'u',
        orgId: 'o1',
        roles: [SystemRole.VIEWER],
        permissions: [],
      },
      { type: 'household', organizationId: 'o2' },
      { action: 'read' },
    );
    expect(d.allow).toBe(false);
    expect(d.reason).toContain('org_isolation');
  });

  it('allows same-org household when geo unrestricted or in scope', async () => {
    // subject with empty geo from buildSubject path — inject via evaluate subject
    const d = await svc.evaluate(
      {
        userId: 'u',
        orgId: 'o1',
        roles: [SystemRole.SOCIAL_WORKER],
        permissions: [],
        neighborhoodIds: [],
      },
      { type: 'household', organizationId: 'o1', neighborhoodId: 'n9' },
      { action: 'read' },
    );
    // org_isolation deny condition requires org mismatch — same org skips deny
    // then geo allow with empty neighborhoodIds returns true for neighborhoodInScope
    expect(d.allow).toBe(true);
  });

  it('assertOrgAccess works', () => {
    expect(svc.assertOrgAccess('o1', 'o1', false)).toBe(true);
    expect(svc.assertOrgAccess('o1', 'o2', false)).toBe(false);
    expect(svc.assertOrgAccess('o1', 'o2', true)).toBe(true);
  });

  it('buildSubject loads geo scopes', async () => {
    const subject = await svc.buildSubject('u1', 'o1', ['viewer'], ['households:read']);
    expect(subject.neighborhoodIds).toEqual(['n1']);
    expect(geoRepo.find).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});
