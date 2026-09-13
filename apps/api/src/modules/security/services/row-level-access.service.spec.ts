import { RowLevelAccessService } from './row-level-access.service';
import { JwtPayload, SystemRole } from '@city-manager/shared';

describe('RowLevelAccessService', () => {
  const geoRepo = {
    find: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
  };
  const userRepo = {
    findOne: jest.fn(async () => ({ id: 'u1', organizationId: 'org1' })),
  };
  const abac = {
    assertOrgAccess: jest.fn((a, b, sa) => sa || a === b),
  };

  const svc = new RowLevelAccessService(geoRepo as never, userRepo as never, abac as never);

  const baseUser = (over: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: 'u1',
    email: 'a@b.c',
    orgId: 'org1',
    roles: [SystemRole.MANAGER],
    permissions: [],
    ...over,
  });

  it('orgScope is null for super_admin', () => {
    expect(svc.orgScope(baseUser({ roles: [SystemRole.SUPER_ADMIN] }))).toBeNull();
    expect(svc.orgScope(baseUser())).toBe('org1');
  });

  it('applyHouseholdFilters adds org clause', async () => {
    geoRepo.find.mockResolvedValueOnce([]);
    const f = await svc.applyHouseholdFilters(baseUser(), 'h');
    expect(f?.sql).toContain('h.organization_id = :rlsOrgId');
    expect(f?.params.rlsOrgId).toBe('org1');
  });

  it('applyHouseholdFilters adds neighborhood when scoped', async () => {
    geoRepo.find.mockResolvedValueOnce([{ neighborhoodId: 'n1' }, { neighborhoodId: 'n2' }]);
    const f = await svc.applyHouseholdFilters(baseUser(), 'h');
    expect(f?.sql).toContain('IN (:...rlsNeighborhoods)');
    expect(f?.params.rlsNeighborhoods).toEqual(['n1', 'n2']);
  });

  it('super_admin has no org filter', async () => {
    geoRepo.find.mockResolvedValueOnce([]);
    const f = await svc.applyHouseholdFilters(
      baseUser({ roles: [SystemRole.SUPER_ADMIN] }),
      'h',
    );
    expect(f).toBeNull();
  });
});
