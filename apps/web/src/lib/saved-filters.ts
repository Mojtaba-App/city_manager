import { SavedFilterPreset } from '@city-manager/shared';

const MAX_PRESETS = 12;

function storageKey(scope: string, userId?: string): string {
  return userId ? `cm:saved-filters:${scope}:${userId}` : `cm:saved-filters:${scope}`;
}

function readRaw<T>(scope: string, userId?: string): SavedFilterPreset<T>[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(scope, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedFilterPreset<T>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw<T>(scope: string, presets: SavedFilterPreset<T>[], userId?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(scope, userId), JSON.stringify(presets));
}

export function loadSavedFilters<T>(scope: string, userId?: string): SavedFilterPreset<T>[] {
  return readRaw<T>(scope, userId);
}

export function saveFilterPreset<T>(
  scope: string,
  name: string,
  filter: T,
  userId?: string,
): SavedFilterPreset<T>[] {
  const trimmed = name.trim();
  if (!trimmed) return readRaw<T>(scope, userId);
  const preset: SavedFilterPreset<T> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    filter,
    createdAt: new Date().toISOString(),
  };
  const next = [preset, ...readRaw<T>(scope, userId)].slice(0, MAX_PRESETS);
  writeRaw(scope, next, userId);
  return next;
}

export function deleteFilterPreset(scope: string, id: string, userId?: string): SavedFilterPreset<unknown>[] {
  const next = readRaw(scope, userId).filter((p) => p.id !== id);
  writeRaw(scope, next, userId);
  return next;
}

export function upsertFilterPreset<T>(
  scope: string,
  id: string,
  name: string,
  filter: T,
  userId?: string,
): SavedFilterPreset<T>[] {
  const prev = readRaw<T>(scope, userId);
  const idx = prev.findIndex((p) => p.id === id);
  if (idx === -1) return saveFilterPreset(scope, name, filter, userId);
  const updated: SavedFilterPreset<T> = {
    ...prev[idx],
    name: name.trim() || prev[idx].name,
    filter,
    createdAt: new Date().toISOString(),
  };
  const next = [...prev];
  next[idx] = updated;
  writeRaw(scope, next, userId);
  return next;
}
