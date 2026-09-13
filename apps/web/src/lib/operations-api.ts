import { API_URL, apiFetch } from './api';

export async function fetchPriorityQueue(limit = 50) {
  return apiFetch(`/case/households/priority-queue?limit=${limit}`, {});
}

export async function fetchMyTasks(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch(`/case/operations/tasks/mine${q}`, {});
}

export async function fetchOverdueTasks() {
  return apiFetch('/case/operations/tasks/overdue', {});
}

export async function assignHousehold(householdId: string, assignedUserId: string, note?: string) {
  return apiFetch(`/case/households/${householdId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignedUserId, note }),
  });
}

export async function fetchHouseholdTasks(householdId: string) {
  return apiFetch(`/case/households/${householdId}/tasks`, {});
}

export async function createHouseholdTask(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateHouseholdTask(householdId: string, taskId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteHouseholdTask(householdId: string, taskId: string) {
  return apiFetch(`/case/households/${householdId}/tasks/${taskId}`, { method: 'DELETE' });
}

export async function fetchHouseholdVisits(householdId: string) {
  return apiFetch(`/case/households/${householdId}/visits`, {});
}

export async function createHouseholdVisit(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/visits`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function completeHouseholdVisit(householdId: string, visitId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/visits/${visitId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchSupportPackages() {
  return apiFetch('/case/support-packages', {});
}

export async function createSupportPackage(payload: Record<string, unknown>) {
  return apiFetch('/case/support-packages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchSupportAssignments(householdId: string) {
  return apiFetch(`/case/households/${householdId}/support-assignments`, {});
}

export async function assignSupportPackage(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/support-assignments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSupportAssignment(householdId: string, assignmentId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/support-assignments/${assignmentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchHouseholdDocuments(householdId: string) {
  return apiFetch(`/case/households/${householdId}/documents`, {});
}

export async function uploadHouseholdDocument(householdId: string, file: File, title: string, category?: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  if (category) form.append('category', category);
  return apiFetch(`/case/households/${householdId}/documents`, {
    method: 'POST',
    body: form,
  });
}

export function documentDownloadUrl(householdId: string, documentId: string) {
  return `${API_URL}/case/households/${householdId}/documents/${documentId}/download`;
}

export async function deleteHouseholdDocument(householdId: string, documentId: string) {
  return apiFetch(`/case/households/${householdId}/documents/${documentId}`, { method: 'DELETE' });
}

export async function fetchVulnerabilityAssessments(householdId: string) {
  return apiFetch(`/case/households/${householdId}/vulnerability`, {});
}

export async function submitVulnerabilityAssessment(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/vulnerability`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMessageOutbox(limit = 50) {
  return apiFetch(`/case/operations/messages?limit=${limit}`, {});
}

export async function sendHouseholdMessage(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
