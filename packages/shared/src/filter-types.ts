/** فاز ۳ — فیلترهای ذخیره‌شده */

import type { AnalyticsFilter } from './analytics-types';

export type HouseholdStatusFilter =
  | 'all'
  | 'draft'
  | 'active'
  | 'suspended'
  | 'graduated'
  | 'withdrawn';

export interface HouseholdListFilter {
  query: string;
  status: HouseholdStatusFilter;
}

export interface SavedFilterPreset<TFilter = unknown> {
  id: string;
  name: string;
  filter: TFilter;
  createdAt: string;
}

export const HOUSEHOLD_STATUS_FILTER_LABELS: Record<HouseholdStatusFilter, string> = {
  all: 'همه وضعیت‌ها',
  draft: 'پیش‌نویس',
  active: 'فعال',
  suspended: 'معلق',
  graduated: 'فارغ‌شده',
  withdrawn: 'انصراف',
};

export const DEFAULT_HOUSEHOLD_LIST_FILTER: HouseholdListFilter = {
  query: '',
  status: 'all',
};

export function isDefaultHouseholdListFilter(filter: HouseholdListFilter): boolean {
  return filter.query.trim() === '' && filter.status === 'all';
}

export function describeHouseholdListFilter(filter: HouseholdListFilter): string {
  const parts: string[] = [];
  if (filter.status !== 'all') {
    parts.push(HOUSEHOLD_STATUS_FILTER_LABELS[filter.status]);
  }
  if (filter.query.trim()) {
    parts.push(`جستجو: ${filter.query.trim()}`);
  }
  return parts.length ? parts.join(' · ') : 'همه پرونده‌ها';
}

export function householdListFiltersEqual(a: HouseholdListFilter, b: HouseholdListFilter): boolean {
  return a.status === b.status && a.query.trim() === b.query.trim();
}

/** فاز ۳+ — فیلترهای ذخیره‌شده تحلیل */
export const DEFAULT_ANALYTICS_FILTER: AnalyticsFilter = {};

function sortedUnique(values?: string[]): string[] {
  if (!values?.length) return [];
  return [...new Set(values.filter(Boolean))].sort();
}

function stringArraysEqual(a?: string[], b?: string[]): boolean {
  const sa = sortedUnique(a);
  const sb = sortedUnique(b);
  if (sa.length !== sb.length) return false;
  return sa.every((v, i) => v === sb[i]);
}

export function normalizeAnalyticsFilter(filter: AnalyticsFilter): AnalyticsFilter {
  const next: AnalyticsFilter = {};
  const neighborhoodIds = sortedUnique(filter.neighborhoodIds);
  const householdStatuses = sortedUnique(filter.householdStatuses);
  const ownershipTypes = sortedUnique(filter.ownershipTypes);
  const educationLevels = sortedUnique(filter.educationLevels);
  const employmentStatuses = sortedUnique(filter.employmentStatuses);

  if (neighborhoodIds.length) next.neighborhoodIds = neighborhoodIds;
  if (householdStatuses.length) next.householdStatuses = householdStatuses;
  if (ownershipTypes.length) next.ownershipTypes = ownershipTypes;
  if (educationLevels.length) next.educationLevels = educationLevels;
  if (employmentStatuses.length) next.employmentStatuses = employmentStatuses;
  if (filter.incomeMin != null && !Number.isNaN(filter.incomeMin)) next.incomeMin = filter.incomeMin;
  if (filter.incomeMax != null && !Number.isNaN(filter.incomeMax)) next.incomeMax = filter.incomeMax;
  if (filter.fromDate?.trim()) next.fromDate = filter.fromDate.trim();
  if (filter.toDate?.trim()) next.toDate = filter.toDate.trim();
  if (filter.memberRole?.trim()) next.memberRole = filter.memberRole.trim();
  return next;
}

export function isDefaultAnalyticsFilter(filter: AnalyticsFilter): boolean {
  return Object.keys(normalizeAnalyticsFilter(filter)).length === 0;
}

export function analyticsFiltersEqual(a: AnalyticsFilter, b: AnalyticsFilter): boolean {
  const na = normalizeAnalyticsFilter(a);
  const nb = normalizeAnalyticsFilter(b);
  return stringArraysEqual(na.neighborhoodIds, nb.neighborhoodIds)
    && stringArraysEqual(na.householdStatuses, nb.householdStatuses)
    && stringArraysEqual(na.ownershipTypes, nb.ownershipTypes)
    && stringArraysEqual(na.educationLevels, nb.educationLevels)
    && stringArraysEqual(na.employmentStatuses, nb.employmentStatuses)
    && (na.incomeMin ?? undefined) === (nb.incomeMin ?? undefined)
    && (na.incomeMax ?? undefined) === (nb.incomeMax ?? undefined)
    && (na.fromDate ?? undefined) === (nb.fromDate ?? undefined)
    && (na.toDate ?? undefined) === (nb.toDate ?? undefined)
    && (na.memberRole ?? undefined) === (nb.memberRole ?? undefined);
}

export function describeAnalyticsFilter(filter: AnalyticsFilter): string {
  const f = normalizeAnalyticsFilter(filter);
  const parts: string[] = [];

  if (f.neighborhoodIds?.length) parts.push(`${f.neighborhoodIds.length} محله`);
  if (f.householdStatuses?.length) parts.push(`${f.householdStatuses.length} وضعیت`);
  if (f.ownershipTypes?.length) parts.push(`${f.ownershipTypes.length} مالکیت`);
  if (f.educationLevels?.length) parts.push(`${f.educationLevels.length} تحصیلات`);
  if (f.employmentStatuses?.length) parts.push(`${f.employmentStatuses.length} اشتغال`);
  if (f.incomeMin != null || f.incomeMax != null) {
    if (f.incomeMin != null && f.incomeMax != null) {
      parts.push(`درآمد ${f.incomeMin}–${f.incomeMax}`);
    } else if (f.incomeMin != null) {
      parts.push(`درآمد ≥ ${f.incomeMin}`);
    } else {
      parts.push(`درآمد ≤ ${f.incomeMax}`);
    }
  }
  if (f.fromDate || f.toDate) {
    parts.push(`بازه ${f.fromDate ?? '…'} تا ${f.toDate ?? '…'}`);
  }
  if (f.memberRole) parts.push(`نقش: ${f.memberRole}`);

  return parts.length ? parts.join(' · ') : 'بدون فیلتر';
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AnalyticsFilterFieldError =
  | 'incomeMin'
  | 'incomeMax'
  | 'incomeRange'
  | 'fromDate'
  | 'toDate'
  | 'dateRange';

export type AnalyticsFilterErrors = Partial<Record<AnalyticsFilterFieldError, string>>;

/** Validate filled filter fields before apply / export (empty filter is allowed). */
export function validateAnalyticsFilter(filter: AnalyticsFilter): AnalyticsFilterErrors {
  const f = normalizeAnalyticsFilter(filter);
  const errors: AnalyticsFilterErrors = {};

  if (f.incomeMin != null && (!Number.isFinite(f.incomeMin) || f.incomeMin < 0)) {
    errors.incomeMin = 'حداقل درآمد باید صفر یا بیشتر باشد';
  }
  if (f.incomeMax != null && (!Number.isFinite(f.incomeMax) || f.incomeMax < 0)) {
    errors.incomeMax = 'حداکثر درآمد باید صفر یا بیشتر باشد';
  }
  if (
    f.incomeMin != null
    && f.incomeMax != null
    && Number.isFinite(f.incomeMin)
    && Number.isFinite(f.incomeMax)
    && f.incomeMin > f.incomeMax
  ) {
    errors.incomeRange = 'حداقل درآمد نباید از حداکثر بیشتر باشد';
  }

  if (f.fromDate && !ISO_DATE_RE.test(f.fromDate)) {
    errors.fromDate = 'تاریخ شروع نامعتبر است';
  }
  if (f.toDate && !ISO_DATE_RE.test(f.toDate)) {
    errors.toDate = 'تاریخ پایان نامعتبر است';
  }
  if (
    f.fromDate
    && f.toDate
    && ISO_DATE_RE.test(f.fromDate)
    && ISO_DATE_RE.test(f.toDate)
    && f.fromDate > f.toDate
  ) {
    errors.dateRange = 'تاریخ شروع نباید بعد از تاریخ پایان باشد';
  }

  return errors;
}

export function analyticsFilterHasErrors(errors: AnalyticsFilterErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function firstAnalyticsFilterError(errors: AnalyticsFilterErrors): string | null {
  const order: AnalyticsFilterFieldError[] = [
    'incomeMin',
    'incomeMax',
    'incomeRange',
    'fromDate',
    'toDate',
    'dateRange',
  ];
  for (const key of order) {
    if (errors[key]) return errors[key]!;
  }
  return null;
}
