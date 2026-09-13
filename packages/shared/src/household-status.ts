import { HouseholdStatus } from './case-types';

export const HOUSEHOLD_STATUS_LABELS: Record<HouseholdStatus, string> = {
  [HouseholdStatus.DRAFT]: 'پیش‌نویس',
  [HouseholdStatus.ACTIVE]: 'فعال',
  [HouseholdStatus.SUSPENDED]: 'معلق',
  [HouseholdStatus.GRADUATED]: 'فارغ‌شده',
  [HouseholdStatus.WITHDRAWN]: 'انصراف',
  [HouseholdStatus.ARCHIVED]: 'بایگانی',
};

/** انتقال‌های مجاز وضعیت پرونده — ماتریس صریح چرخه حیات */
export const HOUSEHOLD_STATUS_TRANSITIONS: Record<HouseholdStatus, HouseholdStatus[]> = {
  [HouseholdStatus.DRAFT]: [HouseholdStatus.ACTIVE, HouseholdStatus.WITHDRAWN, HouseholdStatus.ARCHIVED],
  [HouseholdStatus.ACTIVE]: [HouseholdStatus.SUSPENDED, HouseholdStatus.GRADUATED, HouseholdStatus.WITHDRAWN],
  [HouseholdStatus.SUSPENDED]: [HouseholdStatus.ACTIVE, HouseholdStatus.WITHDRAWN, HouseholdStatus.ARCHIVED],
  [HouseholdStatus.GRADUATED]: [HouseholdStatus.ACTIVE, HouseholdStatus.ARCHIVED],
  [HouseholdStatus.WITHDRAWN]: [HouseholdStatus.DRAFT, HouseholdStatus.ARCHIVED],
  [HouseholdStatus.ARCHIVED]: [],
};

/** وضعیت مجاز هنگام ایجاد پرونده */
export const HOUSEHOLD_CREATE_STATUSES: HouseholdStatus[] = [
  HouseholdStatus.DRAFT,
  HouseholdStatus.ACTIVE,
];

export function isHouseholdStatus(value: unknown): value is HouseholdStatus {
  return Object.values(HouseholdStatus).includes(value as HouseholdStatus);
}

export function getAllowedHouseholdStatusTransitions(
  from: HouseholdStatus | string,
): HouseholdStatus[] {
  if (!isHouseholdStatus(from)) return [];
  return [...HOUSEHOLD_STATUS_TRANSITIONS[from]];
}

export function canTransitionHouseholdStatus(
  from: HouseholdStatus | string,
  to: HouseholdStatus | string,
): boolean {
  if (from === to) return true;
  if (!isHouseholdStatus(from) || !isHouseholdStatus(to)) return false;
  return HOUSEHOLD_STATUS_TRANSITIONS[from].includes(to);
}

export function canCreateHouseholdWithStatus(status: unknown): boolean {
  if (status == null || status === '') return true;
  return isHouseholdStatus(status) && HOUSEHOLD_CREATE_STATUSES.includes(status);
}

export function householdStatusTransitionError(
  from: HouseholdStatus | string,
  to: HouseholdStatus | string,
): string | undefined {
  if (from === to) return undefined;
  if (canTransitionHouseholdStatus(from, to)) return undefined;
  const fromLabel = isHouseholdStatus(from) ? HOUSEHOLD_STATUS_LABELS[from] : String(from);
  const toLabel = isHouseholdStatus(to) ? HOUSEHOLD_STATUS_LABELS[to] : String(to);
  return `انتقال وضعیت از «${fromLabel}» به «${toLabel}» مجاز نیست`;
}
