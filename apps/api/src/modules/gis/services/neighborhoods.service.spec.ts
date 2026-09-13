import { NeighborhoodsService } from './neighborhoods.service';

describe('NeighborhoodsService.create', () => {
  const repo = { findOne: jest.fn(), save: jest.fn() };
  const dataSource = { query: jest.fn() };
  const geometryService = { isValidGeometry: jest.fn(), computeAreaSqm: jest.fn() };
  const programContext = { getDefaultProgramId: jest.fn() };
  const svc = new NeighborhoodsService(
    repo as never,
    dataSource as never,
    geometryService as never,
    programContext as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    programContext.getDefaultProgramId.mockResolvedValue('prog-1');
    dataSource.query.mockResolvedValue([{ id: 'n1', code: 'N-01', name: 'منبع آب' }]);
  });

  it('inserts municipal district, population, area and joint-action status without geometry', async () => {
    const res = await svc.create('org-1', {
      code: 'N-01',
      name: 'منبع آب',
      status: 'joint_action' as never,
      municipalDistrict: 3,
      population: 12000,
      householdCount: 3200,
      avgIncome: 15000000,
      literacyRate: 78.5,
      areaSqm: 45000,
    });
    expect(res.success).toBe(true);
    const sql = String(dataSource.query.mock.calls[0][0]);
    const params = dataSource.query.mock.calls[0][1] as unknown[];
    expect(sql).toContain('municipal_district');
    expect(sql).toContain('population');
    expect(sql).toContain('household_count');
    expect(sql).toContain('avg_income');
    expect(sql).toContain('literacy_rate');
    expect(params).toContain('joint_action');
    expect(params).toContain(3);
    expect(params).toContain(12000);
    expect(params).toContain(3200);
    expect(params).toContain(15000000);
    expect(params).toContain(78.5);
    expect(params).toContain(45000);
  });
});

describe('NeighborhoodsService.update', () => {
  const repo = { findOne: jest.fn(), save: jest.fn(async (v: unknown) => v) };
  const dataSource = { query: jest.fn() };
  const geometryService = { isValidGeometry: jest.fn(), computeAreaSqm: jest.fn() };
  const programContext = { getDefaultProgramId: jest.fn() };
  const svc = new NeighborhoodsService(
    repo as never,
    dataSource as never,
    geometryService as never,
    programContext as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockResolvedValue([{ id: 'n1', name: 'منبع آب' }]);
  });

  it('merges fabric type ids into existing metadata', async () => {
    repo.findOne.mockResolvedValue({
      id: 'n1',
      organizationId: 'org-1',
      metadata: { note: 'keep' },
    });
    await svc.update('org-1', 'n1', { metadata: { fabricTypeIds: ['t1'] } });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { note: 'keep', fabricTypeIds: ['t1'] },
    }));
  });

  it('persists household count, avg income and literacy rate', async () => {
    repo.findOne.mockResolvedValue({
      id: 'n1',
      organizationId: 'org-1',
      metadata: {},
    });
    await svc.update('org-1', 'n1', {
      householdCount: 2100,
      avgIncome: 18_000_000,
      literacyRate: 81,
    });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      householdCount: 2100,
      avgIncome: 18_000_000,
      literacyRate: 81,
    }));
  });
});
