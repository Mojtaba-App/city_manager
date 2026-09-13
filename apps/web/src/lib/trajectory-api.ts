import {
  TrajectoryTimelineItem, TrajectoryCompareResult, TrajectoryTrendPoint,
} from '@city-manager/shared';
import { apiFetch } from './api';

export async function fetchTimeline(householdId: string, memberId?: string) {
  const q = memberId ? `?memberId=${memberId}` : '';
  return apiFetch<TrajectoryTimelineItem[]>(`/trajectory/households/${householdId}/timeline${q}`, {});
}

export async function fetchTrends(householdId: string, memberId?: string) {
  const q = memberId ? `?memberId=${memberId}` : '';
  return apiFetch<{ income: TrajectoryTrendPoint[]; qualityOfLife: TrajectoryTrendPoint[] }>(
    `/trajectory/households/${householdId}/trends${q}`, {},
  );
}

export async function fetchCompare(householdId: string, fromDate?: string, toDate?: string, memberId?: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  if (memberId) params.set('memberId', memberId);
  const q = params.toString() ? `?${params}` : '';
  return apiFetch<TrajectoryCompareResult>(`/trajectory/households/${householdId}/compare${q}`, {});
}

export async function createTrajectoryRecord(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/trajectory/households/${householdId}/records`, {
    method: 'POST', body: JSON.stringify(payload),
  });
}

export async function updateTrajectoryRecord(id: string, payload: Record<string, unknown>) {
  return apiFetch(`/trajectory/records/${id}`, {
    method: 'PATCH', body: JSON.stringify(payload),
  });
}

export async function fetchExpertNotes(householdId: string, memberId?: string) {
  const q = memberId ? `?memberId=${memberId}` : '';
  return apiFetch(`/trajectory/households/${householdId}/notes${q}`, {});
}

export async function createExpertNote(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/trajectory/households/${householdId}/notes`, {
    method: 'POST', body: JSON.stringify(payload),
  });
}

export type { TrajectoryTimelineItem, TrajectoryCompareResult, TrajectoryTrendPoint };
