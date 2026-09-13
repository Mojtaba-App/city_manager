import {
  AnalyticsOverview, AnalyticsFilter, DistributionBucket, TimeSeriesPoint,
  KpiDefinitionConfig, HeatmapPoint, NeighborhoodChoropleth,
} from '@city-manager/shared';
import { API_URL, apiFetch, sessionHeaders } from './api';

function toQuery(filters: AnalyticsFilter): string {
  const q = new URLSearchParams();
  if (filters.neighborhoodIds?.length) q.set('neighborhoodIds', filters.neighborhoodIds.join(','));
  if (filters.householdStatuses?.length) q.set('householdStatuses', filters.householdStatuses.join(','));
  if (filters.ownershipTypes?.length) q.set('ownershipTypes', filters.ownershipTypes.join(','));
  if (filters.educationLevels?.length) q.set('educationLevels', filters.educationLevels.join(','));
  if (filters.employmentStatuses?.length) q.set('employmentStatuses', filters.employmentStatuses.join(','));
  if (filters.incomeMin != null) q.set('incomeMin', String(filters.incomeMin));
  if (filters.incomeMax != null) q.set('incomeMax', String(filters.incomeMax));
  if (filters.fromDate) q.set('fromDate', filters.fromDate);
  if (filters.toDate) q.set('toDate', filters.toDate);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchAnalyticsOverview(filters: AnalyticsFilter = {}) {
  return apiFetch<AnalyticsOverview>(`/analytics/overview${toQuery(filters)}`, {});
}

export async function fetchAnalyticsFilters() {
  return apiFetch<{
    neighborhoods: Array<{ id: string; name: string }>;
    householdStatuses: Array<{ key: string; label: string }>;
    ownershipTypes: Array<{ key: string; label: string }>;
    educationLevels: Array<{ key: string; label: string }>;
    employmentStatuses: Array<{ key: string; label: string }>;
  }>('/analytics/filters', {});
}

export async function fetchHeatmap(filters: AnalyticsFilter = {}) {
  return apiFetch<{
    type: string;
    features: unknown[];
    points: HeatmapPoint[];
  }>(`/analytics/spatial/heatmap${toQuery(filters)}`, {});
}

export async function fetchChoropleth(filters: AnalyticsFilter = {}) {
  return apiFetch<NeighborhoodChoropleth[]>(`/analytics/spatial/neighborhoods${toQuery(filters)}`, {});
}

export async function fetchKpiConfig() {
  return apiFetch<KpiDefinitionConfig[]>('/analytics/kpis/config', {});
}

export async function saveKpiConfig(items: KpiDefinitionConfig[]) {
  return apiFetch('/analytics/kpis/config', {
    method: 'PUT',
    body: JSON.stringify({
      items: items.map((i) => ({
        code: i.code,
        title: i.title,
        metric: i.metric,
        enabled: i.enabled,
        sortOrder: i.sortOrder,
      })),
    }),
  });
}

async function downloadExport(path: string, filters: AnalyticsFilter, filename: string, openWindow = false) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: sessionHeaders(),
    body: JSON.stringify({ filters, title: 'گزارش تحلیلی مدیران شهری' }),
  });
  if (!res.ok) {
    throw new Error(`export failed: ${res.status}`);
  }
  if (openWindow) {
    const html = await res.text();
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAnalyticsExcel(filters: AnalyticsFilter) {
  return downloadExport('/analytics/export/excel', filters, 'analytics-report.xls');
}

export function exportAnalyticsCsv(filters: AnalyticsFilter) {
  return downloadExport('/analytics/export/csv', filters, 'analytics-report.csv');
}

export function exportAnalyticsPdf(filters: AnalyticsFilter) {
  return downloadExport('/analytics/export/pdf', filters, 'analytics-report.html', true);
}

export type { AnalyticsOverview, AnalyticsFilter, DistributionBucket, TimeSeriesPoint, KpiDefinitionConfig };
