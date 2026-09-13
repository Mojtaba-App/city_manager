import { AnalyticsQueryService } from './analytics-query.service';

describe('AnalyticsQueryService.computeKpis', () => {
  it('runs org-scoped KPI SQL', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{
        households_total: 5,
        households_active: 3,
        members_total: 10,
        avg_income: 1000,
        unemployed: 1,
        employment_known: 5,
        tenants: 2,
        ownership_known: 4,
        avg_vulnerability: 1.5,
      }])
      .mockResolvedValueOnce([{ c: 7 }]);
    const svc = new AnalyticsQueryService({ query } as never);
    const kpis = await svc.computeKpis('org-1', {});
    expect(query).toHaveBeenCalled();
    expect(kpis.some((k) => k.code === 'households_total' && k.value === 5)).toBe(true);
  });
});
