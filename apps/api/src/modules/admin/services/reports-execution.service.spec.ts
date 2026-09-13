import { ReportsExecutionService } from './reports-execution.service';
import { ReportRegistryService } from './report-registry.service';
import { DEFAULT_REPORTS, ReportRunResult } from '@city-manager/shared';

describe('ReportsExecutionService', () => {
  const mockQuery = jest.fn();
  const dataSource = { query: mockQuery };
  const defRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
  };
  let registry: ReportRegistryService;
  let service: ReportsExecutionService;

  beforeEach(() => {
    mockQuery.mockReset();
    defRepo.find.mockResolvedValue([]);
    defRepo.findOne.mockResolvedValue(null);
    registry = new ReportRegistryService(dataSource as never, defRepo as never);
    service = new ReportsExecutionService(registry);
  });

  it('rejects unknown report code', async () => {
    await expect(service.run('org-1', 'invalid_code')).rejects.toThrow('کد گزارش نامعتبر');
  });

  it('runs households_by_status with org filter', async () => {
    mockQuery.mockResolvedValue([{ status: 'active', count: 5 }]);
    const result = await service.run('org-1', 'households_by_status');
    expect(result.success).toBe(true);
    expect(result.data.code).toBe('households_by_status');
    expect(result.data.rows).toHaveLength(1);
    expect(mockQuery.mock.calls[0][0]).toContain('organization_id = $1');
    expect(mockQuery.mock.calls[0][1]).toEqual(['org-1']);
  });

  it('runs fabric_coverage without org for super admin scope', async () => {
    mockQuery.mockResolvedValue([]);
    const result = await service.run(null, 'fabric_coverage');
    expect(result.success).toBe(true);
    expect(mockQuery.mock.calls[0][1]).toEqual([]);
  });

  it('exports CSV with BOM-safe column headers', () => {
    const sample: ReportRunResult = {
      code: 'test',
      title: 'Test',
      columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      rows: [{ a: 'x', b: 1 }],
      generatedAt: new Date().toISOString(),
    };
    const csv = service.toCsv(sample);
    expect(csv.split('\n')[0]).toBe('A,B');
    expect(csv).toContain('"x",1');
  });

  it('exports PDF binary starting with %PDF', () => {
    const sample: ReportRunResult = {
      code: 'test',
      title: 'Test Report',
      columns: [{ key: 'a', label: 'A' }],
      rows: [{ a: '1' }],
      generatedAt: new Date().toISOString(),
    };
    const pdf = service.toPdf(sample);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('covers all default report codes', () => {
    expect(DEFAULT_REPORTS.length).toBeGreaterThanOrEqual(5);
    const codes = DEFAULT_REPORTS.map((r) => r.code);
    expect(codes).toContain('households_by_status');
    expect(codes).toContain('recent_audit');
  });

  it('registers a custom template and executes it', async () => {
    mockQuery.mockResolvedValue([{ neighborhood: 'محله ۱', count: 4 }]);
    const def = await registry.registerTemplate('org-1', 'neighborhood_household_counts', 'user-1');
    expect(def.code).toBe('neighborhood_household_counts');
    expect(registry.list().some((r) => r.code === def.code)).toBe(true);
    expect(defRepo.save).toHaveBeenCalled();
    const result = await service.run('org-1', def.code);
    expect(result.data.rows[0].neighborhood).toBe('محله ۱');
    expect(mockQuery.mock.calls[0][0]).toContain('neighborhoods');
  });

  it('refuses unknown custom template', async () => {
    await expect(registry.registerTemplate('org-1', 'not_a_template')).rejects.toThrow(
      'قالب گزارش سفارشی یافت نشد',
    );
  });
});
