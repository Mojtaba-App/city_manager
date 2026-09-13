/** Layout & section toggles for analytics report export (preview before download). */

export type AnalyticsReportFormat = 'pdf' | 'excel' | 'csv';

export type AnalyticsReportFontId = 'vazirmatn' | 'tahoma' | 'system';

export type AnalyticsChartMode = 'none' | 'bar' | 'pie' | 'both';

export type AnalyticsMapInsetCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface AnalyticsReportLayoutSettings {
  title: string;
  subtitle: string;
  caption: string;
  producer: string;
  organization: string;
  font: AnalyticsReportFontId;
  format: AnalyticsReportFormat;

  showKpis: boolean;
  showIncome: boolean;
  showEducation: boolean;
  showEmployment: boolean;
  showOwnership: boolean;
  showHouseholdTimeSeries: boolean;
  showTrajectoryTimeSeries: boolean;
  showFilterSummary: boolean;
  showGeneratedAt: boolean;
  showProducer: boolean;
  showCaption: boolean;

  /** Charts next to numeric distribution tables */
  incomeChart: AnalyticsChartMode;
  educationChart: AnalyticsChartMode;
  employmentChart: AnalyticsChartMode;
  ownershipChart: AnalyticsChartMode;

  /** Spatial inset (neighborhood / fabric / dwelling context) */
  showMapInset: boolean;
  mapInsetCorner: AnalyticsMapInsetCorner;
  mapInsetLabel: string;
  /**
   * Selected map layers for the report inset.
   * Built-ins: `neighborhoods`, `heat_points`
   * Urban GIS: `urban:<layerId>`
   */
  mapLayerIds: string[];
  /** Draw neighborhood name labels on the inset map */
  showNeighborhoodLabels: boolean;
  /** Include a printable neighborhood names table */
  showNeighborhoodTable: boolean;

  /** @deprecated migrated into mapLayerIds */
  showMapNeighborhoods?: boolean;
  /** @deprecated migrated into mapLayerIds */
  showMapHeatPoints?: boolean;
}

export const ANALYTICS_REPORT_BUILTIN_LAYERS = [
  { id: 'neighborhoods', label: 'محله‌ها (پلیگون + نام)' },
  { id: 'heat_points', label: 'املاک / نقاط آسیب‌پذیری' },
] as const;

export type AnalyticsReportBuiltinLayerId = (typeof ANALYTICS_REPORT_BUILTIN_LAYERS)[number]['id'];

export function urbanReportLayerId(layerId: string): string {
  return `urban:${layerId}`;
}

export function parseUrbanReportLayerId(id: string): string | null {
  return id.startsWith('urban:') ? id.slice('urban:'.length) : null;
}

export function reportLayoutHasNeighborhoods(layout: Pick<AnalyticsReportLayoutSettings, 'mapLayerIds'>): boolean {
  return (layout.mapLayerIds ?? []).includes('neighborhoods');
}

export function reportLayoutHasHeatPoints(layout: Pick<AnalyticsReportLayoutSettings, 'mapLayerIds'>): boolean {
  return (layout.mapLayerIds ?? []).includes('heat_points');
}

export function reportLayoutUrbanLayerIds(layout: Pick<AnalyticsReportLayoutSettings, 'mapLayerIds'>): string[] {
  return (layout.mapLayerIds ?? [])
    .map(parseUrbanReportLayerId)
    .filter((id): id is string => Boolean(id));
}

export const ANALYTICS_REPORT_FONT_OPTIONS: Array<{ id: AnalyticsReportFontId; label: string; css: string }> = [
  { id: 'vazirmatn', label: 'وزیرمتن', css: '"Vazirmatn", Tahoma, "Segoe UI", sans-serif' },
  { id: 'tahoma', label: 'تاهوما', css: 'Tahoma, "Segoe UI", Arial, sans-serif' },
  { id: 'system', label: 'سیستمی فارسی', css: 'Tahoma, "Iranian Sans", "Segoe UI", sans-serif' },
];

export const DEFAULT_ANALYTICS_REPORT_LAYOUT: AnalyticsReportLayoutSettings = {
  title: 'گزارش تحلیلی مدیران شهری',
  subtitle: 'توزیع درآمد، تحصیلات، شغل، مالکیت و تحلیل فضایی',
  caption: '',
  producer: '',
  organization: '',
  font: 'vazirmatn',
  format: 'pdf',

  showKpis: true,
  showIncome: true,
  showEducation: true,
  showEmployment: true,
  showOwnership: true,
  showHouseholdTimeSeries: true,
  showTrajectoryTimeSeries: false,
  showFilterSummary: true,
  showGeneratedAt: true,
  showProducer: true,
  showCaption: true,

  incomeChart: 'both',
  educationChart: 'bar',
  employmentChart: 'pie',
  ownershipChart: 'pie',

  showMapInset: true,
  mapInsetCorner: 'top-left',
  mapInsetLabel: 'نمای فضایی محله / ملک',
  mapLayerIds: ['neighborhoods', 'heat_points'],
  showNeighborhoodLabels: true,
  showNeighborhoodTable: true,
};

/** Persian labels for KPI metrics (settings + report). */
export const KPI_METRIC_FA: Record<string, string> = {
  households_total: 'کل خانوارها',
  households_active: 'خانوار فعال',
  members_total: 'کل اعضا',
  avg_income: 'میانگین درآمد',
  unemployment_rate: 'نرخ بیکاری',
  tenant_rate: 'نسبت مستأجر',
  avg_vulnerability: 'میانگین آسیب‌پذیری',
  trajectory_events: 'رویداد خط سیر',
};

/** General KPI group label for the editor. */
export const KPI_GROUP_GENERAL_FA = 'عمومی';

export function kpiMetricLabelFa(metric: string): string {
  return KPI_METRIC_FA[metric] ?? metric;
}

export function analyticsReportFontCss(font: AnalyticsReportFontId): string {
  return ANALYTICS_REPORT_FONT_OPTIONS.find((f) => f.id === font)?.css
    ?? ANALYTICS_REPORT_FONT_OPTIONS[0].css;
}

/** Numeric area in m² for export cells; null when unknown. */
export function neighborhoodAreaSqmValue(areaSqm: unknown): number | null {
  if (areaSqm == null || areaSqm === '') return null;
  const n = Number(areaSqm);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Human-readable Persian area for report tables.
 * Uses هکتار when ≥ 10 000 m², otherwise m².
 */
export function formatNeighborhoodAreaFa(
  areaSqm: unknown,
  formatNumber: (n: number) => string = (n) => String(n),
): string {
  const sqm = neighborhoodAreaSqmValue(areaSqm);
  if (sqm == null) return '—';
  if (sqm >= 10_000) {
    const ha = Math.round((sqm / 10_000) * 100) / 100;
    return `${formatNumber(ha)} هکتار`;
  }
  return `${formatNumber(Math.round(sqm))} م²`;
}

export function normalizeAnalyticsReportLayout(
  partial?: Partial<AnalyticsReportLayoutSettings> | null,
): AnalyticsReportLayoutSettings {
  const merged: AnalyticsReportLayoutSettings = {
    ...DEFAULT_ANALYTICS_REPORT_LAYOUT,
    ...(partial ?? {}),
  };

  let mapLayerIds = Array.isArray(partial?.mapLayerIds)
    ? [...new Set(partial!.mapLayerIds.filter(Boolean))]
    : [...DEFAULT_ANALYTICS_REPORT_LAYOUT.mapLayerIds];

  // Migrate legacy booleans when mapLayerIds was not explicitly saved.
  if (!Array.isArray(partial?.mapLayerIds) && partial) {
    const ids: string[] = [];
    if (partial.showMapNeighborhoods !== false) ids.push('neighborhoods');
    if (partial.showMapHeatPoints !== false) ids.push('heat_points');
    if (partial.showMapNeighborhoods === false && partial.showMapHeatPoints === false) {
      mapLayerIds = [];
    } else if (partial.showMapNeighborhoods != null || partial.showMapHeatPoints != null) {
      mapLayerIds = ids;
    }
  }

  merged.mapLayerIds = mapLayerIds;
  merged.showMapNeighborhoods = mapLayerIds.includes('neighborhoods');
  merged.showMapHeatPoints = mapLayerIds.includes('heat_points');
  if (merged.showNeighborhoodLabels == null) merged.showNeighborhoodLabels = true;
  if (merged.showNeighborhoodTable == null) merged.showNeighborhoodTable = true;
  return merged;
}
