import { FormDefinitionSchema, FormFieldSchema } from '@city-manager/shared';
import { apiFetch } from './api';

export async function fetchHouseholds(page = 1) {
  return apiFetch(`/case/households?page=${page}&limit=20`, {});
}

export async function fetchHousehold(id: string) {
  return apiFetch(`/case/households/${id}`, {});
}

export async function fetchAssignees() {
  return apiFetch<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    displayName: string;
  }>>('/case/assignees', {});
}

export async function createHousehold(payload: Record<string, unknown>) {
  return apiFetch('/case/households', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateHousehold(id: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteHousehold(id: string) {
  return apiFetch<{ id: string }>(`/case/households/${id}`, { method: 'DELETE' });
}

export async function fetchDwellings(page = 1) {
  return apiFetch(`/case/dwellings?page=${page}&limit=20`, {});
}

export async function createDwelling(payload: Record<string, unknown>) {
  return apiFetch('/case/dwellings', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createOwnership(dwellingId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/dwellings/${dwellingId}/ownership`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateDwelling(id: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/dwellings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function fetchMembers(householdId: string) {
  return apiFetch(`/case/households/${householdId}/members`, {});
}

export async function createMember(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/members`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateMember(householdId: string, memberId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteMember(householdId: string, memberId: string) {
  return apiFetch<{ id: string }>(`/case/households/${householdId}/members/${memberId}`, { method: 'DELETE' });
}

export async function fetchAgencies() {
  return apiFetch('/case/agencies', {});
}

export async function fetchInsurance(householdId: string) {
  return apiFetch(`/case/households/${householdId}/insurance`, {});
}

export async function createInsurance(householdId: string, payload: Record<string, unknown>) {
  return apiFetch(`/case/households/${householdId}/insurance`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function fetchFormSchema(entityType: string) {
  return apiFetch<FormDefinitionSchema>(`/case/forms/${entityType}`, {});
}

export async function fetchHistory(householdId: string) {
  return apiFetch(`/case/households/${householdId}/history`, {});
}

export type { FormFieldSchema, FormDefinitionSchema };
