import { AnalyticsSpatialService } from './analytics-spatial.service';

describe('AnalyticsSpatialService.neighborhoodChoropleth', () => {
  const ds = { query: jest.fn() };
  const svc = new AnalyticsSpatialService(ds as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps registered neighborhood population instead of zero member count', async () => {
    ds.query.mockResolvedValue([
      {
        neighborhood_id: 'n1',
        name: 'منبع آب',
        code: 'N-01',
        area_sqm: 45000,
        registered_population: 12000,
        registered_household_count: 3200,
        registered_avg_income: 15000000,
        registered_literacy_rate: 78.5,
        case_household_count: 0,
        member_count: 0,
        case_avg_income: null,
        case_literacy_rate: null,
        geometry: null,
      },
    ]);
    const res = await svc.neighborhoodChoropleth('org-1');
    expect(res.success).toBe(true);
    expect(res.data[0].population).toBe(12000);
    expect(res.data[0].householdCount).toBe(3200);
    expect(res.data[0].avgIncome).toBe(15000000);
    expect(res.data[0].literacyRate).toBe(78.5);
    const sql = String(ds.query.mock.calls[0][0]);
    expect(sql).toContain('n.population AS registered_population');
    expect(sql).toContain('n.household_count AS registered_household_count');
    expect(sql).toContain('n.avg_income AS registered_avg_income');
    expect(sql).toContain('n.literacy_rate AS registered_literacy_rate');
  });
});
