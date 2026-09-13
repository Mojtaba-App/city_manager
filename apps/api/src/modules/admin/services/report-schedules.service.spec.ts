import { ReportSchedulesService } from './report-schedules.service';
import { ReportScheduleFrequency } from '@city-manager/shared';

function repoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => v),
    remove: jest.fn(),
  };
}

describe('ReportSchedulesService', () => {
  const repo = repoMock();
  const svc = new ReportSchedulesService(repo as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.create.mockImplementation((v: unknown) => v);
    repo.save.mockImplementation(async (v: unknown) => v);
  });

  it('computes next run for daily/weekly/monthly', () => {
    const from = new Date('2026-08-15T12:00:00Z');
    expect(svc.computeNextRun(ReportScheduleFrequency.DAILY, from).toISOString())
      .toBe('2026-08-16T12:00:00.000Z');
    expect(svc.computeNextRun(ReportScheduleFrequency.WEEKLY, from).toISOString())
      .toBe('2026-08-22T12:00:00.000Z');
    expect(svc.computeNextRun(ReportScheduleFrequency.MONTHLY, from).toISOString())
      .toBe('2026-09-15T12:00:00.000Z');
  });

  it('creates schedule with nextRunAt', async () => {
    const res = await svc.create('org-1', 'user-1', {
      reportCode: 'households_by_status',
      title: 'وضعیت خانوار',
      frequency: ReportScheduleFrequency.DAILY,
    });
    expect(res.success).toBe(true);
    expect(res.data?.reportCode).toBe('households_by_status');
    expect(res.data?.nextRunAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalled();
  });

  it('finds due schedules', async () => {
    const due = [{ id: 's1', reportCode: 'households_by_status' }];
    repo.find.mockResolvedValue(due);
    const now = new Date('2026-08-15T12:00:00Z');
    const rows = await svc.findDue(now, 10);
    expect(rows).toEqual(due);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      take: 10,
      order: { nextRunAt: 'ASC' },
    }));
  });

  it('markRun advances lastRunAt and nextRunAt', async () => {
    const row = {
      id: 's1',
      organizationId: 'org-1',
      frequency: ReportScheduleFrequency.WEEKLY,
      lastRunAt: null as Date | null,
      nextRunAt: new Date('2026-08-01T00:00:00Z'),
    };
    repo.findOne.mockResolvedValue(row);
    const at = new Date('2026-08-15T00:00:00Z');
    await svc.markRun('org-1', 's1', at);
    expect(row.lastRunAt).toEqual(at);
    expect(row.nextRunAt.toISOString()).toBe('2026-08-22T00:00:00.000Z');
  });
});
