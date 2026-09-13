import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HouseholdsService } from './households.service';
import { HouseholdStatus } from '@city-manager/shared';

function repoMock() {
  return {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => v),
    softRemove: jest.fn(),
    find: jest.fn(),
    manager: { query: jest.fn() },
  };
}

describe('HouseholdsService', () => {
  const repo = repoMock();
  const statusHistoryRepo = repoMock();
  const dwellingRepo = repoMock();
  const changeLog = { log: jest.fn(), findEnrichedByEntity: jest.fn() };
  const rls = { getNeighborhoodScope: jest.fn().mockResolvedValue(null) };
  const svc = new HouseholdsService(
    repo as never,
    statusHistoryRepo as never,
    dwellingRepo as never,
    changeLog as never,
    rls as never,
  );

  const orgId = 'org-1';
  const userId = 'user-1';
  const dwelling = { id: 'd1', organizationId: orgId, neighborhoodId: 'n1', deletedAt: null };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.create.mockImplementation((v: unknown) => v);
    repo.save.mockImplementation(async (v: unknown) => v);
    statusHistoryRepo.save.mockImplementation(async (v: unknown) => v);
    rls.getNeighborhoodScope.mockResolvedValue(null);
  });

  it('creates household as draft by default', async () => {
    dwellingRepo.findOne.mockResolvedValue(dwelling);
    const res = await svc.create(orgId, userId, { dwellingId: 'd1', caseNumber: 'HH-1' } as never);
    expect(res.success).toBe(true);
    expect(res.data?.status).toBe(HouseholdStatus.DRAFT);
    expect(changeLog.log).toHaveBeenCalled();
  });

  it('stores assigned user on create', async () => {
    dwellingRepo.findOne.mockResolvedValue(dwelling);
    const res = await svc.create(orgId, userId, {
      dwellingId: 'd1',
      caseNumber: 'HH-2',
      assignedUserId: 'assignee-9',
    } as never);
    expect(res.data?.assignedUserId).toBe('assignee-9');
  });

  it('rejects illegal create status', async () => {
    dwellingRepo.findOne.mockResolvedValue(dwelling);
    await expect(
      svc.create(orgId, userId, {
        dwellingId: 'd1',
        caseNumber: 'HH-1',
        status: HouseholdStatus.ARCHIVED,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects illegal status transition', async () => {
    repo.findOne.mockResolvedValue({
      id: 'h1',
      organizationId: orgId,
      status: HouseholdStatus.DRAFT,
      version: 1,
    });
    await expect(
      svc.update(orgId, userId, 'h1', {
        status: HouseholdStatus.GRADUATED,
        statusChangeReason: 'تست',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(statusHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('records history on legal transition with reason', async () => {
    repo.findOne.mockResolvedValue({
      id: 'h1',
      organizationId: orgId,
      status: HouseholdStatus.DRAFT,
      version: 1,
    });
    const res = await svc.update(orgId, userId, 'h1', {
      status: HouseholdStatus.ACTIVE,
      statusChangeReason: 'فعال‌سازی پرونده',
    });
    expect(res.data?.status).toBe(HouseholdStatus.ACTIVE);
    expect(statusHistoryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: HouseholdStatus.DRAFT,
        toStatus: HouseholdStatus.ACTIVE,
        reason: 'فعال‌سازی پرونده',
      }),
    );
  });

  it('requires reason when status changes', async () => {
    repo.findOne.mockResolvedValue({
      id: 'h1',
      organizationId: orgId,
      status: HouseholdStatus.DRAFT,
      version: 1,
    });
    await expect(
      svc.update(orgId, userId, 'h1', { status: HouseholdStatus.ACTIVE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when household missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.update(orgId, userId, 'missing', { notes: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Optimistic locking ──────────────────────────────────────────────────
  it('succeeds when expectedVersion matches DB version', async () => {
    repo.findOne.mockResolvedValue({ id: 'h1', organizationId: orgId, status: HouseholdStatus.DRAFT, version: 3 });
    const res = await svc.update(orgId, userId, 'h1', { notes: 'ok', expectedVersion: 3 });
    expect(res.success).toBe(true);
  });

  it('throws ConflictException when expectedVersion does not match', async () => {
    repo.findOne.mockResolvedValue({ id: 'h1', organizationId: orgId, status: HouseholdStatus.DRAFT, version: 5 });
    await expect(
      svc.update(orgId, userId, 'h1', { notes: 'stale', expectedVersion: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
    // Must not persist anything when a conflict is detected.
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('skips version check when expectedVersion is omitted', async () => {
    repo.findOne.mockResolvedValue({ id: 'h1', organizationId: orgId, status: HouseholdStatus.DRAFT, version: 99 });
    const res = await svc.update(orgId, userId, 'h1', { notes: 'no-lock' });
    expect(res.success).toBe(true);
  });

  // ── Geo-scope filtering ─────────────────────────────────────────────────
  it('returns all org households when user has no geo-scope', async () => {
    rls.getNeighborhoodScope.mockResolvedValue(null);
    repo.findAndCount.mockResolvedValue([[{ id: 'h1' }], 1]);
    const user = { sub: 'u1', orgId: 'org-1', roles: [] } as never;
    const res = await svc.findAll(orgId, {}, user);
    expect(res.data).toHaveLength(1);
    // When no geo-scope, the WHERE clause must NOT include neighborhoodId.
    const whereArg = repo.findAndCount.mock.calls[0][0].where;
    expect(whereArg).not.toHaveProperty('neighborhoodId');
  });

  it('filters by neighborhood when user has geo-scope', async () => {
    rls.getNeighborhoodScope.mockResolvedValue(['n1', 'n2']);
    repo.findAndCount.mockResolvedValue([[{ id: 'h2', neighborhoodId: 'n1' }], 1]);
    const user = { sub: 'u2', orgId: 'org-1', roles: [] } as never;
    const res = await svc.findAll(orgId, {}, user);
    expect(res.data).toHaveLength(1);
    const whereArg = repo.findAndCount.mock.calls[0][0].where;
    // The neighborhoodId IN filter must be present.
    expect(whereArg).toHaveProperty('neighborhoodId');
  });
});
