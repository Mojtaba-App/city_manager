import { AnalyticsExportService } from './analytics-export.service';
import type { AnalyticsOverview } from '@city-manager/shared';

const sampleOverview = (): AnalyticsOverview => ({
  generatedAt: new Date().toISOString(),
  filters: {},
  kpis: [
    { id: 'kpi-hh', code: 'hh', title: 'Households', value: 12, format: 'number' },
  ],
  distributions: {
    income: [{ key: 'low', label: 'low', count: 2, percent: 50 }],
    education: [],
    employment: [],
    ownership: [],
  },
  timeSeries: {
    householdsRegistered: [{ period: '2026-01', label: '2026-01', value: 3 }],
    trajectoryEvents: [],
  },
});

describe('AnalyticsExportService', () => {
  const svc = new AnalyticsExportService();

  it('builds CSV with KPI section', () => {
    const csv = svc.buildCsv(sampleOverview());
    expect(csv).toContain('Households');
  });

  it('builds binary PDF', () => {
    const pdf = svc.buildPdf(sampleOverview(), 'Test');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('builds printable HTML fallback', () => {
    const html = svc.buildPdfHtml(sampleOverview());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Households');
  });
});
