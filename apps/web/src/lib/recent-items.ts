const STORAGE_KEY = 'cm:recent-households';
const MAX_ITEMS = 8;

export interface RecentHouseholdItem {
  id: string;
  caseNumber: string;
  label?: string;
  visitedAt: string;
}

export function loadRecentHouseholds(): RecentHouseholdItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentHouseholdItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentHousehold(item: Omit<RecentHouseholdItem, 'visitedAt'>): RecentHouseholdItem[] {
  if (typeof window === 'undefined') return [];
  const entry: RecentHouseholdItem = { ...item, visitedAt: new Date().toISOString() };
  const prev = loadRecentHouseholds().filter((x) => x.id !== item.id);
  const next = [entry, ...prev].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentHouseholds(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
