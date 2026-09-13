/** برنامه بازآفرینی شهری */
export enum RegenerationProgramStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export const REGENERATION_PROGRAM_STATUS_LABELS: Record<RegenerationProgramStatus, string> = {
  [RegenerationProgramStatus.DRAFT]: 'پیش‌نویس',
  [RegenerationProgramStatus.ACTIVE]: 'فعال',
  [RegenerationProgramStatus.PAUSED]: 'متوقف',
  [RegenerationProgramStatus.COMPLETED]: 'تکمیل‌شده',
  [RegenerationProgramStatus.ARCHIVED]: 'بایگانی',
};

export interface RegenerationProgramDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string;
  status: RegenerationProgramStatus | string;
  startDate?: string;
  endDate?: string;
  budgetTotal?: string | number;
  isActive: boolean;
  neighborhoodCount?: number;
  projectCount?: number;
  householdCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportRunResult {
  code: string;
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  generatedAt: string;
}

export enum ReportScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export const REPORT_SCHEDULE_FREQUENCY_LABELS: Record<ReportScheduleFrequency, string> = {
  [ReportScheduleFrequency.DAILY]: 'روزانه',
  [ReportScheduleFrequency.WEEKLY]: 'هفتگی',
  [ReportScheduleFrequency.MONTHLY]: 'ماهانه',
};

export interface GlobalSearchResultItem {
  type: 'household' | 'member' | 'dwelling' | 'neighborhood' | 'project' | 'program';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  /** نتیجه ماسک‌شده (مثلاً راهنمای مجوز PII) */
  masked?: boolean;
}

export interface GlobalSearchResult {
  query: string;
  items: GlobalSearchResultItem[];
  /** آیا کاربر مجوز جستجوی کد ملی دارد */
  canSearchNationalId?: boolean;
}

export enum NeighborhoodStatus {
  NORMAL = 'normal',
  PLANNED = 'planned',
  ACTIVE = 'active',
  JOINT_ACTION = 'joint_action',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export const NEIGHBORHOOD_STATUS_LABELS: Record<NeighborhoodStatus, string> = {
  [NeighborhoodStatus.NORMAL]: 'عادی',
  [NeighborhoodStatus.PLANNED]: 'برنامه‌ریزی‌شده',
  [NeighborhoodStatus.ACTIVE]: 'فعال',
  [NeighborhoodStatus.JOINT_ACTION]: 'اقدام مشترک',
  [NeighborhoodStatus.PAUSED]: 'متوقف',
  [NeighborhoodStatus.COMPLETED]: 'تکمیل‌شده',
  [NeighborhoodStatus.ARCHIVED]: 'بایگانی',
};

export const MUNICIPAL_DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type MunicipalDistrict = (typeof MUNICIPAL_DISTRICTS)[number];

export function isNeighborhoodStatus(value: unknown): value is NeighborhoodStatus {
  return Object.values(NeighborhoodStatus).includes(value as NeighborhoodStatus);
}

export function isMunicipalDistrict(value: unknown): value is MunicipalDistrict {
  const n = Number(value);
  return Number.isInteger(n) && MUNICIPAL_DISTRICTS.includes(n as MunicipalDistrict);
}

/** تفکیک محله شهری (ظرف) از محله هدف بازآفرینی (داخل محله شهری) */
export enum NeighborhoodKind {
  URBAN = 'urban',
  REGENERATION_TARGET = 'regeneration_target',
}

export const NEIGHBORHOOD_KIND_LABELS: Record<NeighborhoodKind, string> = {
  [NeighborhoodKind.URBAN]: 'محله شهری',
  [NeighborhoodKind.REGENERATION_TARGET]: 'محله هدف بازآفرینی',
};

export const NORMAL_FABRIC_TYPE_CODE = 'normal';
export const NORMAL_FABRIC_TYPE_NAME = 'بافت عادی';

export function isNeighborhoodKind(value: unknown): value is NeighborhoodKind {
  return Object.values(NeighborhoodKind).includes(value as NeighborhoodKind);
}

export function neighborhoodKind(row: {
  metadata?: unknown;
  neighborhood_kind?: unknown;
  neighborhoodKind?: unknown;
}): NeighborhoodKind {
  if (row.neighborhood_kind != null && isNeighborhoodKind(row.neighborhood_kind)) {
    return row.neighborhood_kind;
  }
  if (row.neighborhoodKind != null && isNeighborhoodKind(row.neighborhoodKind)) {
    return row.neighborhoodKind;
  }
  const meta = row.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const kind = (meta as { neighborhoodKind?: unknown }).neighborhoodKind;
    if (isNeighborhoodKind(kind)) return kind;
  }
  return NeighborhoodKind.REGENERATION_TARGET;
}

export function neighborhoodParentUrbanId(row: {
  metadata?: unknown;
  parent_urban_neighborhood_id?: unknown;
  parentUrbanNeighborhoodId?: unknown;
}): string | null {
  if (typeof row.parent_urban_neighborhood_id === 'string' && row.parent_urban_neighborhood_id.trim()) {
    return row.parent_urban_neighborhood_id;
  }
  if (typeof row.parentUrbanNeighborhoodId === 'string' && row.parentUrbanNeighborhoodId.trim()) {
    return row.parentUrbanNeighborhoodId;
  }
  const meta = row.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const id = (meta as { parentUrbanNeighborhoodId?: unknown }).parentUrbanNeighborhoodId;
    if (typeof id === 'string' && id.trim()) return id;
  }
  return null;
}

export function filterNeighborhoodsByKind<T extends {
  id: string;
  metadata?: unknown;
  neighborhood_kind?: unknown;
}>(
  neighborhoods: T[],
  kind: NeighborhoodKind,
): T[] {
  return neighborhoods.filter((n) => neighborhoodKind(n) === kind);
}

export function resolveNormalFabricTypeId(
  fabricTypes: Array<{ id: string; code?: string; name?: string }>,
): string | undefined {
  const byCode = fabricTypes.find((t) => t.code === NORMAL_FABRIC_TYPE_CODE);
  if (byCode) return byCode.id;
  const byName = fabricTypes.find((t) => t.name === NORMAL_FABRIC_TYPE_NAME);
  return byName?.id;
}

export interface NeighborhoodDashboardStats {
  neighborhood: Record<string, unknown>;
  householdCount: number;
  memberCount: number;
  avgVulnerability: number | null;
  projectCount: number;
  activeProjectCount: number;
  totalProjectBudget: number;
  avgProgress: number;
  projects: Array<Record<string, unknown>>;
}
