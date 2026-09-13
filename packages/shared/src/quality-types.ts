/** اولویت ۴ — بهبود کیفیت محصول */

export enum DwellingSource {
  CASE = 'case',
  GIS = 'gis',
  INTEGRATION = 'integration',
}

export const DWELLING_SOURCE_LABELS: Record<DwellingSource, string> = {
  [DwellingSource.CASE]: 'پرونده',
  [DwellingSource.GIS]: 'نقشه',
  [DwellingSource.INTEGRATION]: 'یکپارچه‌سازی',
};

export enum PiiAccessPurpose {
  CASE_REVIEW = 'case_review',
  SUPPORT = 'support',
  REFERRAL = 'referral',
  EXPORT = 'export',
  VERIFICATION = 'verification',
  OTHER = 'other',
}

export const PII_ACCESS_PURPOSE_LABELS: Record<PiiAccessPurpose, string> = {
  [PiiAccessPurpose.CASE_REVIEW]: 'بررسی پرونده',
  [PiiAccessPurpose.SUPPORT]: 'ارائه حمایت',
  [PiiAccessPurpose.REFERRAL]: 'ارجاع',
  [PiiAccessPurpose.EXPORT]: 'خروجی گزارش',
  [PiiAccessPurpose.VERIFICATION]: 'احراز هویت',
  [PiiAccessPurpose.OTHER]: 'سایر',
};

export interface DataAccessLogDto {
  id: string;
  userId?: string;
  userName?: string;
  resourceType: string;
  resourceId?: string;
  fieldName?: string;
  accessPurpose: string;
  accessReason?: string;
  createdAt: string;
}

export interface ExportLogDto {
  id: string;
  exportType: string;
  resourceRef?: string;
  accessReason?: string;
  rowCount: number;
  createdAt: string;
}

export interface EnrichedChangeLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changedAt: string;
  changedBy?: string;
  changedByName?: string;
  fieldChanges?: Array<{ field: string; label: string; oldValue?: unknown; newValue?: unknown }>;
}

export const CHANGE_FIELD_LABELS: Record<string, string> = {
  status: 'وضعیت',
  caseNumber: 'شماره پرونده',
  memberCount: 'تعداد اعضا',
  notes: 'یادداشت',
  title: 'عنوان',
  fullAddress: 'آدرس',
  plaque: 'پلاک',
  street: 'خیابان',
  city: 'شهر',
  firstName: 'نام',
  lastName: 'نام خانوادگی',
  memberRole: 'نقش',
  vulnerabilityScore: 'امتیاز آسیب',
  assignedUserId: 'مددکار مسئول',
};
