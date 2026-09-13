import {
  DEFAULT_ANALYTICS_REPORT_LAYOUT,
  KPI_GROUP_GENERAL_FA,
  analyticsReportFontCss,
  formatNeighborhoodAreaFa,
  kpiMetricLabelFa,
  neighborhoodAreaSqmValue,
  normalizeAnalyticsReportLayout,
} from './analytics-report-layout';

describe('analytics-report-layout', () => {
  it('normalizes partial layout over defaults', () => {
    const layout = normalizeAnalyticsReportLayout({ title: 'آزمایش', showIncome: false });
    expect(layout.title).toBe('آزمایش');
    expect(layout.showIncome).toBe(false);
    expect(layout.showKpis).toBe(DEFAULT_ANALYTICS_REPORT_LAYOUT.showKpis);
  });

  it('resolves Persian font CSS', () => {
    expect(analyticsReportFontCss('vazirmatn')).toContain('Vazirmatn');
    expect(analyticsReportFontCss('tahoma')).toContain('Tahoma');
  });

  it('maps KPI metrics to Persian labels and general group', () => {
    expect(kpiMetricLabelFa('households_total')).toBe('کل خانوارها');
    expect(kpiMetricLabelFa('unknown_metric')).toBe('unknown_metric');
    expect(KPI_GROUP_GENERAL_FA).toBe('عمومی');
  });

  it('migrates legacy map layer booleans into mapLayerIds', () => {
    const layout = normalizeAnalyticsReportLayout({
      showMapNeighborhoods: true,
      showMapHeatPoints: false,
    });
    expect(layout.mapLayerIds).toEqual(['neighborhoods']);
    expect(layout.showNeighborhoodLabels).toBe(true);
    expect(layout.showNeighborhoodTable).toBe(true);
  });

  it('formats neighborhood area dynamically (m² / هکتار)', () => {
    expect(neighborhoodAreaSqmValue(null)).toBeNull();
    expect(neighborhoodAreaSqmValue(-1)).toBeNull();
    expect(neighborhoodAreaSqmValue(4500)).toBe(4500);
    expect(formatNeighborhoodAreaFa(undefined)).toBe('—');
    expect(formatNeighborhoodAreaFa(4500, (n) => String(n))).toBe('4500 م²');
    expect(formatNeighborhoodAreaFa(45000, (n) => String(n))).toBe('4.5 هکتار');
    expect(formatNeighborhoodAreaFa(10000, (n) => String(n))).toBe('1 هکتار');
  });
});
