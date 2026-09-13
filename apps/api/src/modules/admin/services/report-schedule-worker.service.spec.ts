import { ReportScheduleWorkerService } from './report-schedule-worker.service';

describe('ReportScheduleWorkerService', () => {
  const schedules = {
    findDue: jest.fn(),
    markRun: jest.fn(),
  };
  const reports = {
    run: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'DISABLE_IN_PROCESS_REPORT_SCHEDULES') return 'true';
      if (key === 'REPORT_SCHEDULE_INTERVAL_MS') return '60000';
      return fallback;
    }),
  };

  let worker: ReportScheduleWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ReportScheduleWorkerService(
      schedules as never,
      reports as never,
      config as never,
    );
  });

  it('skips in-process timer when disabled', () => {
    worker.onModuleInit();
    expect(worker.getMetrics().inProcessDisabled).toBe(true);
  });

  it('runs due schedules and marks success', async () => {
    schedules.findDue.mockResolvedValue([
      { id: 's1', organizationId: 'org-1', reportCode: 'households_by_status' },
    ]);
    reports.run.mockResolvedValue({ success: true, data: {} });
    schedules.markRun.mockResolvedValue(undefined);

    const result = await worker.tick(new Date('2026-08-15T12:00:00Z'));
    expect(result).toEqual({ ran: 1, failed: 0 });
    expect(reports.run).toHaveBeenCalledWith('org-1', 'households_by_status');
    expect(schedules.markRun).toHaveBeenCalledWith('org-1', 's1');
    expect(worker.getMetrics().processedTotal).toBe(1);
  });

  it('continues after a failed schedule run', async () => {
    schedules.findDue.mockResolvedValue([
      { id: 's1', organizationId: 'org-1', reportCode: 'bad' },
      { id: 's2', organizationId: 'org-1', reportCode: 'households_by_status' },
    ]);
    reports.run
      .mockRejectedValueOnce(new Error('کد گزارش نامعتبر'))
      .mockResolvedValueOnce({ success: true, data: {} });
    schedules.markRun.mockResolvedValue(undefined);

    const result = await worker.tick();
    expect(result).toEqual({ ran: 1, failed: 1 });
    expect(schedules.markRun).toHaveBeenCalledTimes(1);
    expect(schedules.markRun).toHaveBeenCalledWith('org-1', 's2');
    expect(worker.getMetrics().failedTotal).toBe(1);
  });
});
