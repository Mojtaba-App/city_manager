/** وظایف و گردش‌کار عملیاتی پرونده */
export enum CaseTaskType {
  GENERAL = 'general',
  FOLLOW_UP = 'follow_up',
  DOCUMENT_REVIEW = 'document_review',
  REFERRAL = 'referral',
  VISIT = 'visit',
  ESCALATION = 'escalation',
}

export enum CaseTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum CaseTaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum FieldVisitStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum SupportPackageCategory {
  LIVELIHOOD = 'livelihood',
  HOUSING = 'housing',
  EMPLOYMENT = 'employment',
  EDUCATION = 'education',
  HEALTH = 'health',
  OTHER = 'other',
}

export enum SupportAssignmentStatus {
  PLANNED = 'planned',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum HouseholdDocumentCategory {
  IDENTITY = 'identity',
  PROPERTY = 'property',
  MEETING = 'meeting',
  PHOTO = 'photo',
  OTHER = 'other',
}

export enum VulnerabilityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum MessageChannel {
  SMS = 'sms',
  EMAIL = 'email',
}

export enum MessageOutboxStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum OperationalEvent {
  HOUSEHOLD_ASSIGNED = 'household.assigned',
  TASK_CREATED = 'task.created',
  TASK_DUE_SOON = 'task.due_soon',
  TASK_OVERDUE = 'task.overdue',
  VISIT_SCHEDULED = 'visit.scheduled',
  SUPPORT_ASSIGNED = 'support.assigned',
  VULNERABILITY_HIGH = 'vulnerability.high',
  STATUS_CHANGED = 'status.changed',
}

export const CASE_TASK_TYPE_LABELS: Record<CaseTaskType, string> = {
  [CaseTaskType.GENERAL]: 'عمومی',
  [CaseTaskType.FOLLOW_UP]: 'پیگیری',
  [CaseTaskType.DOCUMENT_REVIEW]: 'بررسی مدارک',
  [CaseTaskType.REFERRAL]: 'ارجاع',
  [CaseTaskType.VISIT]: 'بازدید',
  [CaseTaskType.ESCALATION]: 'اسکالیشن',
};

export const CASE_TASK_STATUS_LABELS: Record<CaseTaskStatus, string> = {
  [CaseTaskStatus.PENDING]: 'در انتظار',
  [CaseTaskStatus.IN_PROGRESS]: 'در حال انجام',
  [CaseTaskStatus.COMPLETED]: 'انجام‌شده',
  [CaseTaskStatus.CANCELLED]: 'لغوشده',
};

export const FIELD_VISIT_STATUS_LABELS: Record<FieldVisitStatus, string> = {
  [FieldVisitStatus.SCHEDULED]: 'برنامه‌ریزی‌شده',
  [FieldVisitStatus.COMPLETED]: 'تکمیل‌شده',
  [FieldVisitStatus.CANCELLED]: 'لغوشده',
  [FieldVisitStatus.NO_SHOW]: 'عدم حضور',
};

export const CASE_TASK_PRIORITY_LABELS: Record<CaseTaskPriority, string> = {
  [CaseTaskPriority.LOW]: 'کم',
  [CaseTaskPriority.NORMAL]: 'معمول',
  [CaseTaskPriority.HIGH]: 'بالا',
  [CaseTaskPriority.URGENT]: 'فوری',
};

export const SUPPORT_PACKAGE_CATEGORY_LABELS: Record<SupportPackageCategory, string> = {
  [SupportPackageCategory.LIVELIHOOD]: 'معیشتی',
  [SupportPackageCategory.HOUSING]: 'مسکن',
  [SupportPackageCategory.EMPLOYMENT]: 'اشتغال',
  [SupportPackageCategory.EDUCATION]: 'آموزش',
  [SupportPackageCategory.HEALTH]: 'سلامت',
  [SupportPackageCategory.OTHER]: 'سایر',
};

export const VULNERABILITY_LEVEL_LABELS: Record<VulnerabilityLevel, string> = {
  [VulnerabilityLevel.LOW]: 'پایین',
  [VulnerabilityLevel.MEDIUM]: 'متوسط',
  [VulnerabilityLevel.HIGH]: 'بالا',
  [VulnerabilityLevel.CRITICAL]: 'بحرانی',
};

/** ابعاد استاندارد ارزیابی آسیب‌پذیری (۰–۱۰۰) */
export interface VulnerabilityAssessmentInput {
  incomeScore: number;
  housingScore: number;
  healthScore: number;
  employmentScore: number;
  educationScore: number;
  familySizeScore: number;
  notes?: string;
}

export interface VulnerabilityAssessmentResult {
  totalScore: number;
  level: VulnerabilityLevel;
  breakdown: Record<string, number>;
}

export function computeVulnerabilityScore(input: VulnerabilityAssessmentInput): VulnerabilityAssessmentResult {
  const weights = {
    income: 0.25,
    housing: 0.2,
    health: 0.15,
    employment: 0.15,
    education: 0.1,
    familySize: 0.15,
  };
  const clamp = (v: number) => Math.max(0, Math.min(100, Number(v) || 0));
  const breakdown = {
    income: clamp(input.incomeScore),
    housing: clamp(input.housingScore),
    health: clamp(input.healthScore),
    employment: clamp(input.employmentScore),
    education: clamp(input.educationScore),
    familySize: clamp(input.familySizeScore),
  };
  const totalScore = Math.round(
    breakdown.income * weights.income
    + breakdown.housing * weights.housing
    + breakdown.health * weights.health
    + breakdown.employment * weights.employment
    + breakdown.education * weights.education
    + breakdown.familySize * weights.familySize,
  );
  let level = VulnerabilityLevel.LOW;
  if (totalScore >= 75) level = VulnerabilityLevel.CRITICAL;
  else if (totalScore >= 55) level = VulnerabilityLevel.HIGH;
  else if (totalScore >= 35) level = VulnerabilityLevel.MEDIUM;
  return { totalScore, level, breakdown };
}

export function vulnerabilityLevelRank(level: VulnerabilityLevel | string | null | undefined): number {
  switch (level) {
    case VulnerabilityLevel.CRITICAL: return 4;
    case VulnerabilityLevel.HIGH: return 3;
    case VulnerabilityLevel.MEDIUM: return 2;
    case VulnerabilityLevel.LOW: return 1;
    default: return 0;
  }
}
