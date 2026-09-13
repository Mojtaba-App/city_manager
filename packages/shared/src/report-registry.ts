import { ReportDefinition } from './admin-types';

export type ReportColumn = { key: string; label: string };

export type ReportQueryFn = (
  orgId: string | null,
) => Promise<{ columns: ReportColumn[]; rows: Record<string, unknown>[] }>;

export interface RegisteredReport {
  definition: ReportDefinition;
  source: 'builtin' | 'custom';
  run: ReportQueryFn;
}

export class ReportRegistry {
  private readonly reports = new Map<string, RegisteredReport>();

  register(entry: RegisteredReport, { overwrite = false } = {}): void {
    const code = entry.definition.code.trim();
    if (!code) throw new Error('کد گزارش الزامی است');
    const existing = this.reports.get(code);
    if (existing && !overwrite) {
      if (existing.source === 'builtin') {
        throw new Error('نمی‌توان گزارش پیش‌فرض را بازنویسی کرد');
      }
      throw new Error('گزارش با این کد از قبل ثبت شده است');
    }
    this.reports.set(code, { ...entry, definition: { ...entry.definition, code } });
  }

  unregister(code: string): boolean {
    const existing = this.reports.get(code);
    if (!existing) return false;
    if (existing.source === 'builtin') {
      throw new Error('حذف گزارش پیش‌فرض مجاز نیست');
    }
    return this.reports.delete(code);
  }

  get(code: string): RegisteredReport | undefined {
    return this.reports.get(code);
  }

  has(code: string): boolean {
    return this.reports.has(code);
  }

  list(): ReportDefinition[] {
    return [...this.reports.values()].map((r) => r.definition);
  }

  listCustom(): ReportDefinition[] {
    return [...this.reports.values()].filter((r) => r.source === 'custom').map((r) => r.definition);
  }
}

export function createReportRegistry(builtins: RegisteredReport[] = []): ReportRegistry {
  const registry = new ReportRegistry();
  for (const entry of builtins) {
    registry.register({ ...entry, source: 'builtin' }, { overwrite: true });
  }
  return registry;
}
