import { ReportRegistry, createReportRegistry, RegisteredReport } from './report-registry';

const sampleRun = async () => ({ columns: [{ key: 'n', label: 'N' }], rows: [{ n: 1 }] });

function def(code: string, title = code) {
  return {
    id: `rpt-${code}`,
    code,
    title,
    description: title,
    category: 'ops' as const,
    format: 'table' as const,
  };
}

describe('ReportRegistry', () => {
  it('lists built-in reports and runs by code', async () => {
    const builtins: RegisteredReport[] = [
      { definition: def('households_by_status', 'وضعیت'), source: 'builtin', run: sampleRun },
    ];
    const registry = createReportRegistry(builtins);
    expect(registry.list().map((r) => r.code)).toEqual(['households_by_status']);
    const row = registry.get('households_by_status');
    expect(row?.source).toBe('builtin');
    await expect(row!.run(null)).resolves.toEqual({
      columns: [{ key: 'n', label: 'N' }],
      rows: [{ n: 1 }],
    });
  });

  it('registers custom reports and forbids overwriting builtins', () => {
    const registry = createReportRegistry([
      { definition: def('recent_audit'), source: 'builtin', run: sampleRun },
    ]);
    registry.register({
      definition: def('neighborhood_household_counts', 'خانوار محله'),
      source: 'custom',
      run: sampleRun,
    });
    expect(registry.listCustom()).toHaveLength(1);
    expect(() =>
      registry.register({
        definition: def('recent_audit'),
        source: 'custom',
        run: sampleRun,
      }),
    ).toThrow('نمی‌توان گزارش پیش‌فرض را بازنویسی کرد');
  });

  it('unregisters only custom reports', () => {
    const registry = new ReportRegistry();
    registry.register({ definition: def('custom_a'), source: 'custom', run: sampleRun });
    expect(registry.unregister('custom_a')).toBe(true);
    expect(registry.has('custom_a')).toBe(false);
    registry.register({ definition: def('builtin_a'), source: 'builtin', run: sampleRun });
    expect(() => registry.unregister('builtin_a')).toThrow('حذف گزارش پیش‌فرض مجاز نیست');
  });
});
