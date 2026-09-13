import { Injectable, BadRequestException } from '@nestjs/common';
import { ReportRunResult } from '@city-manager/shared';
import { ReportRegistryService } from './report-registry.service';
import { buildSimplePdf } from '../../../common/simple-pdf';

@Injectable()
export class ReportsExecutionService {
  constructor(private readonly registry: ReportRegistryService) {}

  async run(orgId: string | null, code: string): Promise<{ success: true; data: ReportRunResult }> {
    const entry = this.registry.get(code);
    if (!entry) throw new BadRequestException('کد گزارش نامعتبر است');

    try {
      const { columns, rows } = await entry.run(orgId);
      return {
        success: true,
        data: {
          code,
          title: entry.definition.title,
          columns,
          rows,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const message = err instanceof Error ? err.message : 'اجرای گزارش ناموفق بود';
      if (message.includes('پیاده‌سازی نشده') || message.includes('نامعتبر')) {
        throw new BadRequestException(message);
      }
      throw err;
    }
  }

  toCsv(result: ReportRunResult): string {
    const header = result.columns.map((c) => c.label).join(',');
    const lines = result.rows.map((row) =>
      result.columns.map((c) => JSON.stringify(row[c.key] ?? '')).join(','),
    );
    return [header, ...lines].join('\n');
  }

  toPdf(result: ReportRunResult): Buffer {
    return buildSimplePdf({
      title: result.title || result.code,
      subtitle: `Generated: ${result.generatedAt}`,
      headers: result.columns.map((c) => c.label),
      rows: result.rows.map((row) => result.columns.map((c) => String(row[c.key] ?? ''))),
    });
  }
}
