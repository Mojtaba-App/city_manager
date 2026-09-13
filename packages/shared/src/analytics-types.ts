export interface AnalyticsFilter {
  neighborhoodIds?: string[];
  householdStatuses?: string[];
  ownershipTypes?: string[];
  educationLevels?: string[];
  employmentStatuses?: string[];
  incomeMin?: number;
  incomeMax?: number;
  fromDate?: string;
  toDate?: string;
  memberRole?: string;
}

export interface DistributionBucket {
  key: string;
  label: string;
  count: number;
  percent: number;
  value?: number;
}

export interface TimeSeriesPoint {
  period: string;
  label: string;
  value: number;
}

export interface AnalyticsKpi {
  id: string;
  code: string;
  title: string;
  value: number | string;
  unit?: string;
  trend?: number;
  format?: 'number' | 'percent' | 'currency';
  description?: string;
}

export interface KpiDefinitionConfig {
  id: string;
  code: string;
  title: string;
  metric: string;
  enabled: boolean;
  sortOrder: number;
  /** گروه نمایش در تنظیمات — پیش‌فرض: عمومی */
  group?: string;
}

export interface HeatmapPoint {
  lng: number;
  lat: number;
  weight: number;
  householdId?: string;
  label?: string;
}

export interface NeighborhoodChoropleth {
  neighborhoodId: string;
  name: string;
  code?: string;
  householdCount: number;
  population?: number;
  avgIncome?: number;
  literacyRate?: number;
  areaSqm?: number;
  avgVulnerability?: number;
  geometry?: Record<string, unknown> | null;
}

/** Prefer the registered neighborhood population; fall back to counted household members. */
export function resolveDisplayedPopulation(registered: unknown, countedMembers: unknown): number {
  if (registered != null && registered !== '') {
    const n = Number(registered);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const counted = Number(countedMembers);
  return Number.isFinite(counted) && counted > 0 ? counted : 0;
}

/** Prefer registered neighborhood household count; fall back to counted case households. */
export function resolveDisplayedHouseholdCount(registered: unknown, countedHouseholds: unknown): number {
  return resolveDisplayedPopulation(registered, countedHouseholds);
}

/**
 * Prefer a registered neighborhood metric (income / literacy).
 * Falls back to computed value when the registered field was not entered.
 */
export function resolveDisplayedOptionalMetric(
  registered: unknown,
  computed: unknown,
): number | undefined {
  if (registered != null && registered !== '') {
    const n = Number(registered);
    if (Number.isFinite(n)) return n;
  }
  if (computed != null && computed !== '') {
    const n = Number(computed);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export interface AnalyticsOverview {
  filters: AnalyticsFilter;
  kpis: AnalyticsKpi[];
  distributions: {
    income: DistributionBucket[];
    education: DistributionBucket[];
    employment: DistributionBucket[];
    ownership: DistributionBucket[];
  };
  timeSeries: {
    householdsRegistered: TimeSeriesPoint[];
    trajectoryEvents: TimeSeriesPoint[];
  };
  generatedAt: string;
}

export const DEFAULT_KPI_DEFINITIONS: KpiDefinitionConfig[] = [
  { id: 'kpi-hh-total', code: 'households_total', title: 'کل خانوارها', metric: 'households_total', enabled: true, sortOrder: 1, group: 'عمومی' },
  { id: 'kpi-hh-active', code: 'households_active', title: 'خانوار فعال', metric: 'households_active', enabled: true, sortOrder: 2, group: 'عمومی' },
  { id: 'kpi-members', code: 'members_total', title: 'کل اعضا', metric: 'members_total', enabled: true, sortOrder: 3, group: 'عمومی' },
  { id: 'kpi-avg-income', code: 'avg_income', title: 'میانگین درآمد', metric: 'avg_income', enabled: true, sortOrder: 4, group: 'عمومی' },
  { id: 'kpi-unemployed', code: 'unemployment_rate', title: 'نرخ بیکاری', metric: 'unemployment_rate', enabled: true, sortOrder: 5, group: 'عمومی' },
  { id: 'kpi-tenant', code: 'tenant_rate', title: 'نسبت مستأجر', metric: 'tenant_rate', enabled: true, sortOrder: 6, group: 'عمومی' },
  { id: 'kpi-vuln', code: 'avg_vulnerability', title: 'میانگین آسیب‌پذیری', metric: 'avg_vulnerability', enabled: true, sortOrder: 7, group: 'عمومی' },
  { id: 'kpi-traj', code: 'trajectory_events', title: 'رویداد خط سیر', metric: 'trajectory_events', enabled: false, sortOrder: 8, group: 'عمومی' },
];

export const INCOME_BANDS = [
  { key: 'unknown', label: 'نامشخص', min: null, max: null },
  { key: 'u5m', label: 'کمتر از ۵ میلیون', min: 0, max: 5_000_000 },
  { key: '5_10m', label: '۵ تا ۱۰ میلیون', min: 5_000_000, max: 10_000_000 },
  { key: '10_20m', label: '۱۰ تا ۲۰ میلیون', min: 10_000_000, max: 20_000_000 },
  { key: '20_40m', label: '۲۰ تا ۴۰ میلیون', min: 20_000_000, max: 40_000_000 },
  { key: 'o40m', label: 'بیش از ۴۰ میلیون', min: 40_000_000, max: null },
] as const;
