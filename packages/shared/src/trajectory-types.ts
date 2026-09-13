export enum TrajectoryRecordType {
  LIFE_EVENT = 'life_event',
  PERIODIC_ASSESSMENT = 'periodic_assessment',
}

export enum LifeEventType {
  JOB_CHANGE = 'job_change',
  INCOME_CHANGE = 'income_change',
  HOUSING_CHANGE = 'housing_change',
  QOL_CHANGE = 'qol_change',
  SUPPORT_STATUS_CHANGE = 'support_status_change',
  EDUCATION_CHANGE = 'education_change',
  EMPLOYMENT_CHANGE = 'employment_change',
  HEALTH_CHANGE = 'health_change',
  MARRIAGE = 'marriage',
  DIVORCE = 'divorce',
  BIRTH = 'birth',
  DEATH = 'death',
  MIGRATION = 'migration',
  OTHER = 'other',
}

export enum SupportTrajectoryStatus {
  NONE = 'none',
  APPLIED = 'applied',
  APPROVED = 'approved',
  RECEIVING = 'receiving',
  SUSPENDED = 'suspended',
  GRADUATED = 'graduated',
  WITHDRAWN = 'withdrawn',
}

export const LIFE_EVENT_LABELS: Record<LifeEventType, string> = {
  [LifeEventType.JOB_CHANGE]: 'تغییر شغل',
  [LifeEventType.INCOME_CHANGE]: 'تغییر درآمد',
  [LifeEventType.HOUSING_CHANGE]: 'تغییر محل سکونت',
  [LifeEventType.QOL_CHANGE]: 'تغییر کیفیت زندگی',
  [LifeEventType.SUPPORT_STATUS_CHANGE]: 'تغییر وضعیت حمایت',
  [LifeEventType.EDUCATION_CHANGE]: 'تغییر تحصیلات',
  [LifeEventType.EMPLOYMENT_CHANGE]: 'تغییر وضعیت اشتغال',
  [LifeEventType.HEALTH_CHANGE]: 'تغییر وضعیت سلامت',
  [LifeEventType.MARRIAGE]: 'ازدواج',
  [LifeEventType.DIVORCE]: 'طلاق',
  [LifeEventType.BIRTH]: 'تولد',
  [LifeEventType.DEATH]: 'فوت',
  [LifeEventType.MIGRATION]: 'مهاجرت',
  [LifeEventType.OTHER]: 'سایر',
};

export interface TrajectoryTimelineItem {
  id: string;
  recordType: TrajectoryRecordType;
  eventType?: LifeEventType;
  eventDate?: string;
  periodStart?: string;
  periodEnd?: string;
  memberId?: string;
  memberName?: string;
  title: string;
  summary: string;
  qualityOfLifeScore?: number;
  supportStatus?: SupportTrajectoryStatus;
  createdAt: string;
}

export interface TrajectoryCompareResult {
  baselineDate: string;
  currentDate: string;
  householdId: string;
  memberId?: string;
  changes: Array<{
    field: string;
    label: string;
    before: unknown;
    after: unknown;
    changed: boolean;
  }>;
  eventsBetween: TrajectoryTimelineItem[];
}

export interface TrajectoryTrendPoint {
  date: string;
  income?: number;
  qualityOfLifeScore?: number;
  label?: string;
}
