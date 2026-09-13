import { API_URL, apiFetch, sessionHeaders } from './api';
import { AreaProjectDto, ReportDefinition, ReportRunResult, GlobalSearchResult } from '@city-manager/shared';

export async function fetchPrograms() {
  return apiFetch<Array<Record<string, unknown>>>('/gis/programs', {});
}

export async function fetchProgram(id: string) {
  return apiFetch<Record<string, unknown>>(`/gis/programs/${id}`, {});
}

export async function createProgram(payload: Record<string, unknown>) {
  return apiFetch('/gis/programs', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateProgram(id: string, payload: Record<string, unknown>) {
  return apiFetch(`/gis/programs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteProgram(id: string) {
  return apiFetch(`/gis/programs/${id}`, { method: 'DELETE' });
}

export async function fetchNeighborhoodDashboard(id: string) {
  return apiFetch<Record<string, unknown>>(`/gis/neighborhoods/${id}/dashboard`, {});
}

export async function updateAreaProject(id: string, payload: Record<string, unknown>) {
  return apiFetch<AreaProjectDto>(`/gis/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function runReport(code: string) {
  return apiFetch<ReportRunResult>(`/admin/reports/run/${code}`, {});
}

export function reportCsvUrl(code: string) {
  return `${API_URL}/admin/reports/run/${code}/csv`;
}

export async function downloadReportCsv(code: string, filename?: string) {
  const res = await fetch(reportCsvUrl(code), {
    credentials: 'include',
    headers: sessionHeaders(false),
  });
  if (!res.ok) return { success: false as const, error: { message: 'دریافت CSV ناموفق بود' } };
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${code}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return { success: true as const };
}

export function reportPdfUrl(code: string) {
  return `${API_URL}/admin/reports/run/${code}/pdf`;
}

export async function downloadReportPdf(code: string, filename?: string) {
  const res = await fetch(reportPdfUrl(code), {
    credentials: 'include',
    headers: sessionHeaders(false),
  });
  if (!res.ok) return { success: false as const, error: { message: 'دریافت PDF ناموفق بود' } };
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${code}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  return { success: true as const };
}

export async function fetchReportSchedules() {
  return apiFetch<Array<Record<string, unknown>>>('/admin/report-schedules', {});
}

export async function createReportSchedule(payload: Record<string, unknown>) {
  return apiFetch('/admin/report-schedules', { method: 'POST', body: JSON.stringify(payload) });
}

export async function toggleReportSchedule(id: string, isEnabled: boolean) {
  return apiFetch(`/admin/report-schedules/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isEnabled }),
  });
}

export async function deleteReportSchedule(id: string) {
  return apiFetch(`/admin/report-schedules/${id}`, { method: 'DELETE' });
}

export async function globalSearch(q: string, limit = 20) {
  return apiFetch<GlobalSearchResult>(`/admin/search?q=${encodeURIComponent(q)}&limit=${limit}`, {});
}

export async function fetchFormDefinitions() {
  return apiFetch<Array<Record<string, unknown>>>('/case/forms', {});
}

export async function upsertFormDefinition(payload: Record<string, unknown>) {
  return apiFetch('/case/forms', { method: 'POST', body: JSON.stringify(payload) });
}

export async function fetchHouseholdByDwelling(dwellingId: string) {
  return apiFetch(`/case/households/by-dwelling/${dwellingId}`, {});
}

export type { ReportDefinition, ReportRunResult };
