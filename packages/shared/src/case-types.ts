export enum HouseholdStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  GRADUATED = 'graduated',
  WITHDRAWN = 'withdrawn',
  ARCHIVED = 'archived',
}

export enum MemberRole {
  HEAD = 'head',
  SPOUSE = 'spouse',
  CHILD = 'child',
  PARENT = 'parent',
  RELATIVE = 'relative',
  OTHER = 'other',
}

export enum OwnershipType {
  OWNER = 'owner',
  TENANT = 'tenant',
  RENT_FREE = 'rent_free',
  COOPERATIVE = 'cooperative',
  NO_DEED = 'no_deed',
  SHARED = 'shared',
  OTHER = 'other',
}

export const OWNERSHIP_TYPE_LABELS: Record<OwnershipType, string> = {
  [OwnershipType.OWNER]: 'مالک',
  [OwnershipType.TENANT]: 'مستأجر',
  [OwnershipType.RENT_FREE]: 'رایگان / امانی',
  [OwnershipType.COOPERATIVE]: 'تعاونی',
  [OwnershipType.NO_DEED]: 'فاقد سند',
  [OwnershipType.SHARED]: 'مشاع',
  [OwnershipType.OTHER]: 'سایر',
};

/** Normalize legacy / Persian / alias ownership values to OwnershipType */
export function normalizeOwnershipType(value: unknown): OwnershipType | undefined {
  if (value == null || value === '') return undefined;
  const raw = String(value).trim().toLowerCase();
  const aliases: Record<string, OwnershipType> = {
    owner: OwnershipType.OWNER,
    مالک: OwnershipType.OWNER,
    ownership: OwnershipType.OWNER,
    owned: OwnershipType.OWNER,
    tenant: OwnershipType.TENANT,
    مستاجر: OwnershipType.TENANT,
    مستأجر: OwnershipType.TENANT,
    renter: OwnershipType.TENANT,
    rent: OwnershipType.TENANT,
    rent_free: OwnershipType.RENT_FREE,
    rentfree: OwnershipType.RENT_FREE,
    free: OwnershipType.RENT_FREE,
    امانی: OwnershipType.RENT_FREE,
    cooperative: OwnershipType.COOPERATIVE,
    تعاونی: OwnershipType.COOPERATIVE,
    no_deed: OwnershipType.NO_DEED,
    nodeed: OwnershipType.NO_DEED,
    فاقد_سند: OwnershipType.NO_DEED,
    shared: OwnershipType.SHARED,
    مشاع: OwnershipType.SHARED,
    other: OwnershipType.OTHER,
    سایر: OwnershipType.OTHER,
  };
  if (aliases[raw]) return aliases[raw];
  if (Object.values(OwnershipType).includes(raw as OwnershipType)) return raw as OwnershipType;
  return OwnershipType.OTHER;
}

export function isOwnershipType(value: unknown): value is OwnershipType {
  return Object.values(OwnershipType).includes(value as OwnershipType);
}

export enum LandUseType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  OFFICE = 'office',
  MIXED = 'mixed',
  INDUSTRIAL = 'industrial',
  EDUCATIONAL = 'educational',
  HEALTHCARE = 'healthcare',
  GREEN = 'green',
  RELIGIOUS = 'religious',
  OTHER = 'other',
}

export const LAND_USE_LABELS: Record<LandUseType, string> = {
  [LandUseType.RESIDENTIAL]: 'مسکونی',
  [LandUseType.COMMERCIAL]: 'تجاری',
  [LandUseType.OFFICE]: 'اداری',
  [LandUseType.MIXED]: 'مختلط',
  [LandUseType.INDUSTRIAL]: 'صنعتی',
  [LandUseType.EDUCATIONAL]: 'آموزشی',
  [LandUseType.HEALTHCARE]: 'درمانی',
  [LandUseType.GREEN]: 'فضای سبز',
  [LandUseType.RELIGIOUS]: 'مذهبی',
  [LandUseType.OTHER]: 'سایر',
};

export function isLandUseType(value: unknown): value is LandUseType {
  return Object.values(LandUseType).includes(value as LandUseType);
}

export enum EducationLevel {
  NONE = 'none',
  PRIMARY = 'primary',
  MIDDLE = 'middle',
  HIGH_SCHOOL = 'high_school',
  DIPLOMA = 'diploma',
  ASSOCIATE = 'associate',
  BACHELOR = 'bachelor',
  MASTER = 'master',
  DOCTORATE = 'doctorate',
  OTHER = 'other',
}

export enum EmploymentStatus {
  EMPLOYED = 'employed',
  SELF_EMPLOYED = 'self_employed',
  UNEMPLOYED = 'unemployed',
  STUDENT = 'student',
  RETIRED = 'retired',
  HOMEMAKER = 'homemaker',
  DISABLED = 'disabled',
  OTHER = 'other',
}

export enum CaseEntityType {
  DWELLING = 'dwelling',
  HOUSEHOLD = 'household',
  MEMBER = 'member',
  INSURANCE = 'insurance',
  OWNERSHIP = 'ownership',
  TRAJECTORY = 'trajectory',
}

export const CASE_ENTITY_TYPE_LABELS: Record<CaseEntityType, string> = {
  [CaseEntityType.DWELLING]: 'ملک',
  [CaseEntityType.HOUSEHOLD]: 'خانوار',
  [CaseEntityType.MEMBER]: 'عضو',
  [CaseEntityType.INSURANCE]: 'بیمه',
  [CaseEntityType.OWNERSHIP]: 'مالکیت',
  [CaseEntityType.TRAJECTORY]: 'خط سیر',
};

export const FORM_FIELD_TYPES = ['text', 'number', 'date', 'select', 'textarea', 'boolean'] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'متن',
  number: 'عدد',
  date: 'تاریخ',
  select: 'انتخابی',
  textarea: 'متن بلند',
  boolean: 'بله/خیر',
};

/** Technical key stored in custom_fields JSON. */
export const FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export interface FormFieldSchema {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  section?: string;
}

export interface FormDefinitionSchema {
  sections: Array<{ id: string; title: string }>;
  fields: FormFieldSchema[];
}

export interface FormNextStep {
  href: string;
  label: string;
  hint: string;
}

export function isCaseEntityType(value: unknown): value is CaseEntityType {
  return typeof value === 'string' && (Object.values(CaseEntityType) as string[]).includes(value);
}

export function isFormFieldType(value: unknown): value is FormFieldType {
  return typeof value === 'string' && (FORM_FIELD_TYPES as readonly string[]).includes(value);
}

export function nextUniqueFieldKey(fields: Array<{ key: string }>, prefix = 'field'): string {
  const used = new Set(fields.map((f) => f.key));
  let n = fields.length + 1;
  while (used.has(`${prefix}_${n}`)) n += 1;
  return `${prefix}_${n}`;
}

/** Where a saved form is actually filled in the app. */
export function getFormNextSteps(entityType: string): FormNextStep[] {
  switch (entityType) {
    case CaseEntityType.HOUSEHOLD:
      return [
        {
          href: '/dashboard/households/new',
          label: 'ثبت خانوار جدید',
          hint: 'فیلدهای سفارشی خانوار در مرحله اطلاعات تکمیلی همین ویزارد ظاهر می‌شوند.',
        },
        {
          href: '/dashboard/households',
          label: 'فهرست خانوارها',
          hint: 'برای مشاهده پرونده‌های موجود.',
        },
      ];
    case CaseEntityType.MEMBER:
      return [
        {
          href: '/dashboard/households/new',
          label: 'ثبت خانوار جدید',
          hint: 'فیلدهای عضو در مرحله سرپرست خانوار نمایش داده می‌شوند.',
        },
        {
          href: '/dashboard/households',
          label: 'پرونده خانوار',
          hint: 'از فهرست وارد پرونده شوید.',
        },
      ];
    case CaseEntityType.DWELLING:
      return [
        {
          href: '/dashboard/households/new',
          label: 'ثبت خانوار و ملک',
          hint: 'ثبت ملک همراه ویزارد خانوار جدید انجام می‌شود.',
        },
        {
          href: '/dashboard/map',
          label: 'نقشه GIS',
          hint: 'املاک را روی نقشه ببینید.',
        },
      ];
    case CaseEntityType.INSURANCE:
      return [
        {
          href: '/dashboard/households',
          label: 'پرونده خانوار',
          hint: 'بیمه از داخل پرونده خانوار ثبت می‌شود.',
        },
      ];
    case CaseEntityType.OWNERSHIP:
      return [
        {
          href: '/dashboard/households',
          label: 'پرونده خانوار',
          hint: 'مالکیت از داخل پرونده خانوار پیگیری می‌شود.',
        },
      ];
    case CaseEntityType.TRAJECTORY:
      return [
        {
          href: '/dashboard/households',
          label: 'پرونده خانوار',
          hint: 'خط سیر در پرونده خانوار ثبت می‌شود.',
        },
      ];
    default:
      return [
        {
          href: '/dashboard/today',
          label: 'پیشخوان',
          hint: 'از پیشخوان به بخش مرتبط بروید.',
        },
      ];
  }
}
