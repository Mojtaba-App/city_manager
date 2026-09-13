import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService.getStats', () => {
  it('aggregates dashboard KPIs in a single SQL round-trip', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        users_total: 10,
        users_active: 8,
        households_total: 20,
        households_active: 15,
        dwellings_total: 12,
        neighborhoods_total: 4,
        fabrics_total: 3,
        trajectory_events_total: 7,
        recent_activity_count: 9,
      },
    ]);
    const auditRepo = { count: jest.fn() };
    const settingsRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const svc = new AdminDashboardService(
      { query } as never,
      auditRepo as never,
      settingsRepo as never,
    );

    const res = await svc.getStats('org-1');
    expect(res.success).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(res.data.usersActive).toBe(8);
    expect(res.data.householdsActive).toBe(15);
    expect(res.data.recentActivityCount).toBe(9);
  });
});
