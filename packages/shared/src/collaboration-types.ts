/** کانال‌های کاربری و همکاری بین‌سازمانی — اولویت ۳ */

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_OVERDUE = 'task_overdue',
  VISIT_SCHEDULED = 'visit_scheduled',
  HOUSEHOLD_ASSIGNED = 'household_assigned',
  REFERRAL_CREATED = 'referral_created',
  REFERRAL_STATUS = 'referral_status',
  CONSENT_REQUIRED = 'consent_required',
  DOCUMENT_UPLOADED = 'document_uploaded',
  SYNC_FAILED = 'sync_failed',
  SYSTEM = 'system',
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.TASK_ASSIGNED]: 'وظیفه جدید',
  [NotificationType.TASK_OVERDUE]: 'وظیفه سررسید گذشته',
  [NotificationType.VISIT_SCHEDULED]: 'بازدید میدانی',
  [NotificationType.HOUSEHOLD_ASSIGNED]: 'ارجاع پرونده',
  [NotificationType.REFERRAL_CREATED]: 'ارجاع بین‌سازمانی',
  [NotificationType.REFERRAL_STATUS]: 'وضعیت ارجاع',
  [NotificationType.CONSENT_REQUIRED]: 'نیاز به رضایت',
  [NotificationType.DOCUMENT_UPLOADED]: 'بارگذاری مدرک',
  [NotificationType.SYNC_FAILED]: 'خطای همگام‌سازی',
  [NotificationType.SYSTEM]: 'سیستمی',
};

export interface InAppNotificationDto {
  id: string;
  type: NotificationType | string;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export enum ConsentPurpose {
  AGENCY_REFERRAL = 'agency_referral',
  SUPPORT_PACKAGE = 'support_package',
  DATA_SHARING = 'data_sharing',
  PORTAL_ACCESS = 'portal_access',
  RESEARCH = 'research',
}

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  [ConsentPurpose.AGENCY_REFERRAL]: 'ارجاع به ارگان',
  [ConsentPurpose.SUPPORT_PACKAGE]: 'بسته حمایتی',
  [ConsentPurpose.DATA_SHARING]: 'اشتراک داده',
  [ConsentPurpose.PORTAL_ACCESS]: 'دسترسی پورتال',
  [ConsentPurpose.RESEARCH]: 'پژوهش',
};

export enum ConsentStatus {
  PENDING = 'pending',
  GRANTED = 'granted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  [ConsentStatus.PENDING]: 'در انتظار',
  [ConsentStatus.GRANTED]: 'اعطا شده',
  [ConsentStatus.REVOKED]: 'لغو شده',
  [ConsentStatus.EXPIRED]: 'منقضی',
};

export enum ReferralStatus {
  DRAFT = 'draft',
  PENDING_CONSENT = 'pending_consent',
  READY = 'ready',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  [ReferralStatus.DRAFT]: 'پیش‌نویس',
  [ReferralStatus.PENDING_CONSENT]: 'منتظر رضایت',
  [ReferralStatus.READY]: 'آماده ارسال',
  [ReferralStatus.SENT]: 'ارسال‌شده',
  [ReferralStatus.ACCEPTED]: 'پذیرفته',
  [ReferralStatus.REJECTED]: 'رد شده',
  [ReferralStatus.EXPIRED]: 'منقضی',
  [ReferralStatus.CANCELLED]: 'لغو شده',
};

/** حداقل داده‌ای که با رضایت قابل اشتراک است */
export type ReferralDataScope =
  | 'case_summary'
  | 'member_count'
  | 'vulnerability'
  | 'address_district'
  | 'contact_phone'
  | 'support_history';

export const REFERRAL_DATA_SCOPE_LABELS: Record<ReferralDataScope, string> = {
  case_summary: 'خلاصه پرونده',
  member_count: 'تعداد اعضا',
  vulnerability: 'امتیاز آسیب‌پذیری',
  address_district: 'منطقه / محله',
  contact_phone: 'تلفن تماس',
  support_history: 'سابقه حمایت',
};

export const DEFAULT_REFERRAL_SCOPES: ReferralDataScope[] = ['case_summary', 'member_count'];

/** مقصد ارجاع: ارگان همکار یا واحد منطقه شهرداری */
export enum ReferralDestinationKind {
  PARTNER_AGENCY = 'partner_agency',
  MUNICIPAL_DISTRICT = 'municipal_district',
}

export const REFERRAL_DESTINATION_KIND_LABELS: Record<ReferralDestinationKind, string> = {
  [ReferralDestinationKind.PARTNER_AGENCY]: 'سازمان / ارگان همکار',
  [ReferralDestinationKind.MUNICIPAL_DISTRICT]: 'منطقه شهرداری',
};

export interface MunicipalReferralDestination {
  kind: ReferralDestinationKind.MUNICIPAL_DISTRICT;
  municipalDistrict: number;
  code: string;
  label: string;
  description: string;
}

export function municipalReferralDestinationCode(district: number): string {
  return `muni-district-${Number(district)}`;
}

export function municipalReferralDestinationLabel(district: number): string {
  return `منطقه ${Number(district)} شهرداری`;
}

/** گزینه‌های پویا برای ارجاع به مناطق ۱–۸ شهرداری */
export function listMunicipalReferralDestinations(
  districts: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8],
): MunicipalReferralDestination[] {
  return districts.map((d) => ({
    kind: ReferralDestinationKind.MUNICIPAL_DISTRICT,
    municipalDistrict: d,
    code: municipalReferralDestinationCode(d),
    label: municipalReferralDestinationLabel(d),
    description: 'واحد منطقه شهرداری — پس از تعریف دسترسی می‌توانند ارجاع را ببینند، پیگیری و اقدام کنند',
  }));
}

export function consentCoversScopes(consentScopes: string[] | null | undefined, required: string[]): boolean {
  const set = new Set(consentScopes ?? []);
  return required.every((s) => set.has(s));
}

export function missingConsentScopes(consentScopes: string[] | null | undefined, required: string[]): string[] {
  const set = new Set(consentScopes ?? []);
  return required.filter((s) => !set.has(s));
}

export function normalizeReferralScopes(scopes?: string[] | null): ReferralDataScope[] {
  const allowed = new Set(Object.keys(REFERRAL_DATA_SCOPE_LABELS));
  const cleaned = [...new Set((scopes ?? []).filter((s) => allowed.has(s)))] as ReferralDataScope[];
  return cleaned.length ? cleaned : [...DEFAULT_REFERRAL_SCOPES];
}

export function formatReferralDestinationLabel(input: {
  destinationKind?: string | null;
  destinationLabel?: string | null;
  municipalDistrict?: number | null;
  agencyName?: string | null;
}): string {
  if (input.destinationLabel?.trim()) return input.destinationLabel.trim();
  if (input.destinationKind === ReferralDestinationKind.MUNICIPAL_DISTRICT && input.municipalDistrict != null) {
    return municipalReferralDestinationLabel(Number(input.municipalDistrict));
  }
  return input.agencyName?.trim() || '—';
}

export enum PortalInviteStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export interface PortalHouseholdSummary {
  caseNumber: string;
  status: string;
  memberCount: number;
  neighborhoodName?: string;
  addressHint?: string;
  notesPublic?: string;
}
