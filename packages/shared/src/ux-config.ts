/**
 * گام ۰ — UX سبک: پیکربندی مرکزی تجربه کاربری بر اساس نقش
 * گام ۲ — فاز ۲: split view و drawer
 * گام ۳ — فاز ۳: command palette، onboarding
 */

/** پرسونای UX — ممکن است با SystemRole یکی نباشد (مثلاً field_worker از مجوز field:access) */
export enum UxPersona {
  SOCIAL_WORKER = 'social_worker',
  FIELD_WORKER = 'field_worker',
  GIS_ANALYST = 'gis_analyst',
  MANAGER = 'manager',
  ADMIN = 'admin',
  ANALYST = 'analyst',
  DEFAULT = 'default',
}

export const UX_PERSONA_LABELS: Record<UxPersona, string> = {
  [UxPersona.SOCIAL_WORKER]: 'مددکار اجتماعی',
  [UxPersona.FIELD_WORKER]: 'کارمند میدانی',
  [UxPersona.GIS_ANALYST]: 'کارشناس GIS',
  [UxPersona.MANAGER]: 'مدیر',
  [UxPersona.ADMIN]: 'مدیر سازمان',
  [UxPersona.ANALYST]: 'تحلیل‌گر',
  [UxPersona.DEFAULT]: 'کاربر',
};

export type HouseholdDetailTab =
  | 'info'
  | 'operations'
  | 'members'
  | 'collaboration'
  | 'insurance'
  | 'history';

export const HOUSEHOLD_TAB_LABELS: Record<HouseholdDetailTab, string> = {
  info: 'خانوار / منزل',
  operations: 'عملیات',
  members: 'اعضا',
  collaboration: 'همکاری',
  insurance: 'بیمه',
  history: 'تاریخچه',
};

/** فیلدهای نوار خلاصه پرونده — همیشه visible */
export const SUMMARY_BAR_FIELD_KEYS = [
  'status',
  'caseNumber',
  'memberCount',
  'assignedUserId',
  'vulnerabilityScore',
  'dwellingAddress',
] as const;

export type SummaryBarFieldKey = (typeof SUMMARY_BAR_FIELD_KEYS)[number];

export const SUMMARY_BAR_FIELD_LABELS: Record<SummaryBarFieldKey, string> = {
  status: 'وضعیت',
  caseNumber: 'شماره پرونده',
  memberCount: 'اعضا',
  assignedUserId: 'مددکار مسئول',
  vulnerabilityScore: 'امتیاز آسیب',
  dwellingAddress: 'آدرس',
};

export type TodayWidgetId =
  | 'my_tasks'
  | 'overdue_tasks'
  | 'field_visits'
  | 'field_summary'
  | 'notifications'
  | 'recent_households'
  | 'quick_actions'
  | 'admin_stats';

export interface TodayWidgetConfig {
  id: TodayWidgetId;
  label: string;
  description: string;
  /** مجوز لازم — undefined = همه */
  permission?: string;
  anyOf?: string[];
  /** ستون grid: 1=کامل، 2=نیمه */
  span?: 1 | 2;
}

export interface HouseholdCtaConfig {
  id: string;
  label: string;
  icon: string;
  /** مسیر با :householdId و :dwellingId */
  hrefTemplate?: string;
  tab?: HouseholdDetailTab;
  permission?: string;
  anyOf?: string[];
}

export interface MapCaseLinkRules {
  dwellingQueryParam: 'dwelling';
  neighborhoodQueryParam: 'neighborhood';
  projectQueryParam: 'project';
  caseQueryParam: 'case';
  tabQueryParam: 'tab';
  /** اولویت باز کردن نقشه برای این entity types در جستجو */
  mapFirstFor: Array<'dwelling' | 'neighborhood' | 'project'>;
}

export const MAP_CASE_LINK_RULES: MapCaseLinkRules = {
  dwellingQueryParam: 'dwelling',
  neighborhoodQueryParam: 'neighborhood',
  projectQueryParam: 'project',
  caseQueryParam: 'case',
  tabQueryParam: 'tab',
  mapFirstFor: ['dwelling', 'neighborhood', 'project'],
};

/** فاز ۲ — نحوه نمایش پرونده در context مختلف */
export type CasePresentationMode = 'page' | 'drawer' | 'split';

export type CasePresentationContext = 'map' | 'households_list';

const TAB_ORDER: Record<UxPersona, HouseholdDetailTab[]> = {
  [UxPersona.SOCIAL_WORKER]: ['operations', 'info', 'members', 'collaboration', 'insurance', 'history'],
  [UxPersona.FIELD_WORKER]: ['operations', 'info', 'members', 'collaboration', 'history', 'insurance'],
  [UxPersona.GIS_ANALYST]: ['info', 'operations', 'members', 'collaboration', 'insurance', 'history'],
  [UxPersona.MANAGER]: ['info', 'operations', 'members', 'collaboration', 'insurance', 'history'],
  [UxPersona.ADMIN]: ['info', 'operations', 'members', 'collaboration', 'insurance', 'history'],
  [UxPersona.ANALYST]: ['info', 'history', 'operations', 'members', 'collaboration', 'insurance'],
  [UxPersona.DEFAULT]: ['info', 'members', 'operations', 'collaboration', 'insurance', 'history'],
};

const DEFAULT_TAB: Record<UxPersona, HouseholdDetailTab> = {
  [UxPersona.SOCIAL_WORKER]: 'operations',
  [UxPersona.FIELD_WORKER]: 'operations',
  [UxPersona.GIS_ANALYST]: 'info',
  [UxPersona.MANAGER]: 'info',
  [UxPersona.ADMIN]: 'info',
  [UxPersona.ANALYST]: 'info',
  [UxPersona.DEFAULT]: 'info',
};

const LANDING_ROUTE: Record<UxPersona, string> = {
  [UxPersona.SOCIAL_WORKER]: '/dashboard/today',
  [UxPersona.FIELD_WORKER]: '/dashboard/field',
  [UxPersona.GIS_ANALYST]: '/dashboard/map',
  [UxPersona.MANAGER]: '/dashboard',
  [UxPersona.ADMIN]: '/dashboard',
  [UxPersona.ANALYST]: '/dashboard/analytics',
  [UxPersona.DEFAULT]: '/dashboard/today',
};

const TODAY_WIDGETS: Record<UxPersona, TodayWidgetConfig[]> = {
  [UxPersona.SOCIAL_WORKER]: [
    { id: 'quick_actions', label: 'میانبرها', description: 'اقدامات پرتکرار', span: 2 },
    { id: 'my_tasks', label: 'وظایف من', description: 'وظایف باز امروز', permission: 'operations:read' },
    { id: 'overdue_tasks', label: 'تأخیرها', description: 'وظایف سررسید گذشته', permission: 'operations:read' },
    { id: 'notifications', label: 'اعلان‌ها', description: 'خوانده‌نشده', permission: 'notifications:read' },
    { id: 'recent_households', label: 'پرونده‌های اخیر', description: 'آخرین بازدیدها', permission: 'households:read', span: 2 },
  ],
  [UxPersona.FIELD_WORKER]: [
    { id: 'field_summary', label: 'خلاصه امروز', description: 'بازدیدهای میدانی', permission: 'field:access' },
    { id: 'field_visits', label: 'بازدیدهای من', description: 'لیست بازدید', permission: 'field:access', span: 2 },
    { id: 'quick_actions', label: 'میانبرها', description: 'جستجو و نقشه', span: 2 },
    { id: 'recent_households', label: 'پرونده‌های اخیر', description: 'دسترسی سریع', permission: 'households:read' },
  ],
  [UxPersona.GIS_ANALYST]: [
    { id: 'quick_actions', label: 'میانبرها', description: 'نقشه و لایه‌ها', span: 2 },
    { id: 'recent_households', label: 'ملک/پرونده اخیر', description: 'ادامه کار', permission: 'households:read' },
    { id: 'notifications', label: 'اعلان‌ها', description: 'خوانده‌نشده', permission: 'notifications:read' },
  ],
  [UxPersona.MANAGER]: [
    { id: 'admin_stats', label: 'شاخص‌های کلیدی', description: 'نمای سازمان', permission: 'org:read', span: 2 },
    { id: 'overdue_tasks', label: 'تأخیر عملیات', description: 'نیاز توجه', permission: 'operations:read' },
    { id: 'notifications', label: 'اعلان‌ها', description: 'خوانده‌نشده', permission: 'notifications:read' },
    { id: 'quick_actions', label: 'میانبرها', description: 'گزارش و پرونده', span: 2 },
  ],
  [UxPersona.ADMIN]: [
    { id: 'admin_stats', label: 'شاخص‌های کلیدی', description: 'نمای سازمان', permission: 'org:read', span: 2 },
    { id: 'notifications', label: 'اعلان‌ها', description: 'خوانده‌نشده', permission: 'notifications:read' },
    { id: 'quick_actions', label: 'میانبرها', description: 'مدیریت سامانه', span: 2 },
  ],
  [UxPersona.ANALYST]: [
    { id: 'quick_actions', label: 'میانبرها', description: 'تحلیل و گزارش', span: 2 },
    { id: 'admin_stats', label: 'آمار کلی', description: 'شاخص‌ها', permission: 'org:read' },
    { id: 'recent_households', label: 'پرونده‌های اخیر', description: 'ادامه بررسی', permission: 'households:read' },
  ],
  [UxPersona.DEFAULT]: [
    { id: 'quick_actions', label: 'میانبرها', description: 'دسترسی سریع', span: 2 },
    { id: 'notifications', label: 'اعلان‌ها', description: 'خوانده‌نشده', permission: 'notifications:read' },
    { id: 'recent_households', label: 'پرونده‌های اخیر', description: 'ادامه کار', permission: 'households:read' },
  ],
};

const HOUSEHOLD_CTAS: Record<UxPersona, HouseholdCtaConfig[]> = {
  [UxPersona.SOCIAL_WORKER]: [
    { id: 'operations', label: 'عملیات', icon: 'activity', tab: 'operations', permission: 'operations:read' },
    { id: 'trajectory', label: 'خط سیر', icon: 'trajectory', hrefTemplate: '/dashboard/households/:householdId/trajectory', permission: 'trajectory:read' },
    { id: 'map', label: 'نقشه', icon: 'map', hrefTemplate: '/dashboard/map?:dwellingQuery', anyOf: ['dwellings:read', 'gis_layers:read'] },
    { id: 'members', label: 'اعضا', icon: 'households', tab: 'members', permission: 'members:read' },
  ],
  [UxPersona.FIELD_WORKER]: [
    { id: 'operations', label: 'بازدید/عملیات', icon: 'activity', tab: 'operations', permission: 'operations:read' },
    { id: 'map', label: 'نقشه', icon: 'map', hrefTemplate: '/dashboard/map?:dwellingQuery', anyOf: ['dwellings:read', 'gis_layers:read'] },
    { id: 'field', label: 'کار میدانی', icon: 'map', hrefTemplate: '/dashboard/field', permission: 'field:access' },
  ],
  [UxPersona.GIS_ANALYST]: [
    { id: 'map', label: 'نقشه ملک', icon: 'map', hrefTemplate: '/dashboard/map?:dwellingQuery', anyOf: ['dwellings:read', 'gis_layers:read'] },
    { id: 'info', label: 'جزئیات منزل', icon: 'dwellings', tab: 'info' },
    { id: 'trajectory', label: 'خط سیر', icon: 'trajectory', hrefTemplate: '/dashboard/households/:householdId/trajectory', permission: 'trajectory:read' },
  ],
  [UxPersona.MANAGER]: [
    { id: 'operations', label: 'عملیات', icon: 'activity', tab: 'operations', permission: 'operations:read' },
    { id: 'trajectory', label: 'خط سیر', icon: 'trajectory', hrefTemplate: '/dashboard/households/:householdId/trajectory', permission: 'trajectory:read' },
    { id: 'map', label: 'نقشه', icon: 'map', hrefTemplate: '/dashboard/map?:dwellingQuery', anyOf: ['dwellings:read', 'gis_layers:read'] },
  ],
  [UxPersona.ADMIN]: [
    { id: 'operations', label: 'عملیات', icon: 'activity', tab: 'operations', permission: 'operations:read' },
    { id: 'map', label: 'نقشه', icon: 'map', hrefTemplate: '/dashboard/map?:dwellingQuery', anyOf: ['dwellings:read', 'gis_layers:read'] },
    { id: 'history', label: 'تاریخچه', icon: 'activity', tab: 'history', permission: 'households:read' },
  ],
  [UxPersona.ANALYST]: [
    { id: 'trajectory', label: 'خط سیر', icon: 'trajectory', hrefTemplate: '/dashboard/households/:householdId/trajectory', permission: 'trajectory:read' },
    { id: 'history', label: 'تاریخچه', icon: 'activity', tab: 'history' },
    { id: 'map', label: 'نقشه', icon: 'map', hrefTemplate: '/dashboard/map?:dwellingQuery', anyOf: ['dwellings:read', 'gis_layers:read'] },
  ],
  [UxPersona.DEFAULT]: [
    { id: 'info', label: 'اطلاعات', icon: 'households', tab: 'info' },
    { id: 'map', label: 'نقشه', icon: 'map', hrefTemplate: '/dashboard/map?:dwellingQuery', anyOf: ['dwellings:read', 'gis_layers:read'] },
  ],
};

/** اولویت نقش برای resolve — بالاتر = مهم‌تر */
const ROLE_PERSONA_PRIORITY: Array<{ match: (roles: string[], permissions: string[]) => boolean; persona: UxPersona }> = [
  {
    match: (roles) => roles.includes('super_admin') || roles.includes('org_admin'),
    persona: UxPersona.ADMIN,
  },
  {
    match: (roles, perms) => perms.includes('field:access') && !roles.includes('manager'),
    persona: UxPersona.FIELD_WORKER,
  },
  {
    match: (roles) => roles.includes('social_worker'),
    persona: UxPersona.SOCIAL_WORKER,
  },
  {
    match: (roles, perms) =>
      (perms.includes('gis_layers:read') || perms.includes('gis:ingest')) &&
      !roles.includes('social_worker'),
    persona: UxPersona.GIS_ANALYST,
  },
  {
    match: (roles) => roles.includes('analyst'),
    persona: UxPersona.ANALYST,
  },
  {
    match: (roles) => roles.includes('manager'),
    persona: UxPersona.MANAGER,
  },
];

export function resolveUxPersona(roles: string[] = [], permissions: string[] = []): UxPersona {
  for (const rule of ROLE_PERSONA_PRIORITY) {
    if (rule.match(roles, permissions)) return rule.persona;
  }
  return UxPersona.DEFAULT;
}

export function getDefaultLandingRoute(persona: UxPersona): string {
  return LANDING_ROUTE[persona] ?? LANDING_ROUTE[UxPersona.DEFAULT];
}

export function getHouseholdTabsForPersona(persona: UxPersona): HouseholdDetailTab[] {
  return TAB_ORDER[persona] ?? TAB_ORDER[UxPersona.DEFAULT];
}

export function getDefaultHouseholdTab(persona: UxPersona): HouseholdDetailTab {
  return DEFAULT_TAB[persona] ?? DEFAULT_TAB[UxPersona.DEFAULT];
}

export function getTodayWidgetsForPersona(persona: UxPersona): TodayWidgetConfig[] {
  return TODAY_WIDGETS[persona] ?? TODAY_WIDGETS[UxPersona.DEFAULT];
}

export function getHouseholdCtasForPersona(persona: UxPersona): HouseholdCtaConfig[] {
  return HOUSEHOLD_CTAS[persona] ?? HOUSEHOLD_CTAS[UxPersona.DEFAULT];
}

export function filterWidgetsByAccess(
  widgets: TodayWidgetConfig[],
  hasPermission: (p: string) => boolean,
  hasAnyPermission: (ps: string[]) => boolean,
): TodayWidgetConfig[] {
  return widgets.filter((w) => {
    if (w.anyOf?.length) return hasAnyPermission(w.anyOf);
    if (w.permission) return hasPermission(w.permission);
    return true;
  });
}

export function filterCtasByAccess(
  ctas: HouseholdCtaConfig[],
  hasPermission: (p: string) => boolean,
  hasAnyPermission: (ps: string[]) => boolean,
): HouseholdCtaConfig[] {
  return ctas.filter((c) => {
    if (c.anyOf?.length) return hasAnyPermission(c.anyOf);
    if (c.permission) return hasPermission(c.permission);
    return true;
  });
}

/** ساخت URL نقشه/پرونده — گام ۰ قوانین deep link */
export function buildMapUrl(params: {
  dwellingId?: string;
  neighborhoodId?: string;
  projectId?: string;
}): string {
  const q = new URLSearchParams();
  if (params.dwellingId) q.set(MAP_CASE_LINK_RULES.dwellingQueryParam, params.dwellingId);
  if (params.neighborhoodId) q.set(MAP_CASE_LINK_RULES.neighborhoodQueryParam, params.neighborhoodId);
  if (params.projectId) q.set(MAP_CASE_LINK_RULES.projectQueryParam, params.projectId);
  const qs = q.toString();
  return `/dashboard/map${qs ? `?${qs}` : ''}`;
}

export function buildHouseholdUrl(householdId: string, tab?: HouseholdDetailTab): string {
  const base = `/dashboard/households/${householdId}`;
  if (tab && tab !== 'info') return `${base}?tab=${tab}`;
  return base;
}

export function resolveCtaHref(
  template: string,
  ctx: { householdId: string; dwellingId?: string },
): string {
  if (template.includes(':dwellingQuery') && ctx.dwellingId) {
    return buildMapUrl({ dwellingId: ctx.dwellingId });
  }
  return template
    .replace(':householdId', ctx.householdId)
    .replace('?:dwellingQuery', ctx.dwellingId ? `?${MAP_CASE_LINK_RULES.dwellingQueryParam}=${ctx.dwellingId}` : '');
}

export function shouldOpenMapFirst(entityType: string): boolean {
  return MAP_CASE_LINK_RULES.mapFirstFor.includes(entityType as typeof MAP_CASE_LINK_RULES.mapFirstFor[number]);
}

/** فاز ۲ — نقش و context تعیین می‌کنند drawer / split / page */
export function getCasePresentationMode(
  persona: UxPersona,
  context: CasePresentationContext,
): CasePresentationMode {
  if (context === 'households_list') {
    return 'split';
  }
  if (persona === UxPersona.GIS_ANALYST || persona === UxPersona.FIELD_WORKER) {
    return 'drawer';
  }
  if (persona === UxPersona.SOCIAL_WORKER || persona === UxPersona.MANAGER) {
    return 'drawer';
  }
  return 'drawer';
}

export function buildMapCaseUrl(params: {
  householdId: string;
  dwellingId?: string;
  tab?: HouseholdDetailTab;
}): string {
  const q = new URLSearchParams();
  if (params.dwellingId) q.set(MAP_CASE_LINK_RULES.dwellingQueryParam, params.dwellingId);
  q.set(MAP_CASE_LINK_RULES.caseQueryParam, params.householdId);
  if (params.tab && params.tab !== 'info') q.set(MAP_CASE_LINK_RULES.tabQueryParam, params.tab);
  return `/dashboard/map?${q.toString()}`;
}

export function buildHouseholdSplitUrl(householdId: string, tab?: HouseholdDetailTab): string {
  const q = new URLSearchParams();
  q.set(MAP_CASE_LINK_RULES.caseQueryParam, householdId);
  if (tab && tab !== 'info') q.set(MAP_CASE_LINK_RULES.tabQueryParam, tab);
  return `/dashboard/households?${q.toString()}`;
}

export function resolvePostLoginRoute(roles: string[] = [], permissions: string[] = []): string {
  return getDefaultLandingRoute(resolveUxPersona(roles, permissions));
}

/** فاز ۳ — command palette و onboarding */
export const ONBOARDING_STORAGE_VERSION = 1;

export interface QuickActionConfig {
  id: string;
  label: string;
  href: string;
  icon: string;
}

export interface OnboardingStepConfig {
  id: string;
  title: string;
  body: string;
  href?: string;
  ctaLabel?: string;
}

const QUICK_ACTIONS: Record<UxPersona, QuickActionConfig[]> = {
  [UxPersona.SOCIAL_WORKER]: [
    { id: 'new_hh', label: 'پرونده جدید', href: '/dashboard/households/new', icon: 'plus-home' },
    { id: 'households', label: 'فهرست خانوار', href: '/dashboard/households', icon: 'households' },
    { id: 'operations', label: 'مرکز عملیات', href: '/dashboard/operations', icon: 'activity' },
    { id: 'notifications', label: 'اعلان‌ها', href: '/dashboard/notifications', icon: 'bell' },
  ],
  [UxPersona.FIELD_WORKER]: [
    { id: 'field', label: 'کار میدانی', href: '/dashboard/field', icon: 'map' },
    { id: 'map', label: 'نقشه', href: '/dashboard/map', icon: 'map' },
    { id: 'households', label: 'جستجوی پرونده', href: '/dashboard/households', icon: 'households' },
  ],
  [UxPersona.GIS_ANALYST]: [
    { id: 'map', label: 'نقشه GIS', href: '/dashboard/map', icon: 'map' },
    { id: 'layers', label: 'لایه‌ها', href: '/dashboard/layers', icon: 'layers' },
    { id: 'neighborhoods', label: 'محلات', href: '/dashboard/neighborhoods', icon: 'neighborhood' },
  ],
  [UxPersona.MANAGER]: [
    { id: 'dashboard', label: 'داشبورد', href: '/dashboard', icon: 'dashboard' },
    { id: 'reports', label: 'گزارش‌ها', href: '/dashboard/reports', icon: 'reports' },
    { id: 'households', label: 'خانوارها', href: '/dashboard/households', icon: 'households' },
  ],
  [UxPersona.ADMIN]: [
    { id: 'dashboard', label: 'داشبورد', href: '/dashboard', icon: 'dashboard' },
    { id: 'users', label: 'کاربران', href: '/dashboard/users', icon: 'users' },
    { id: 'settings', label: 'تنظیمات', href: '/dashboard/settings', icon: 'settings' },
  ],
  [UxPersona.ANALYST]: [
    { id: 'analytics', label: 'تحلیل', href: '/dashboard/analytics', icon: 'analytics' },
    { id: 'reports', label: 'گزارش‌ها', href: '/dashboard/reports', icon: 'reports' },
  ],
  [UxPersona.DEFAULT]: [
    { id: 'households', label: 'خانوارها', href: '/dashboard/households', icon: 'households' },
    { id: 'map', label: 'نقشه', href: '/dashboard/map', icon: 'map' },
  ],
};

const ONBOARDING_STEPS: Record<UxPersona, OnboardingStepConfig[]> = {
  [UxPersona.SOCIAL_WORKER]: [
    {
      id: 'today',
      title: 'میز کار «امروز من»',
      body: 'وظایف، تأخیرها و پرونده‌های اخیر را در یک نگاه ببینید.',
      href: '/dashboard/today',
      ctaLabel: 'رفتن به امروز من',
    },
    {
      id: 'command_palette',
      title: 'Command Palette',
      body: 'با Ctrl+K (یا ⌘K) به هر صفحه بروید، جستجو کنید و میانبرها را اجرا کنید.',
    },
    {
      id: 'saved_filters',
      title: 'فیلترهای ذخیره‌شده',
      body: 'در فهرست خانوار و داشبورد تحلیلی، فیلترها را ذخیره کنید تا دفعه بعد یک‌کلیک اعمال شود.',
      href: '/dashboard/households',
      ctaLabel: 'فهرست خانوار',
    },
  ],
  [UxPersona.FIELD_WORKER]: [
    {
      id: 'field',
      title: 'کانال میدانی',
      body: 'بازدیدهای امروز و ثبت یافته را از صفحه کار میدانی انجام دهید.',
      href: '/dashboard/field',
      ctaLabel: 'کار میدانی',
    },
    {
      id: 'command_palette',
      title: 'Command Palette',
      body: 'Ctrl+K برای پرش سریع بین نقشه، پرونده و بازدیدها.',
    },
    {
      id: 'map_case',
      title: 'پرونده کنار نقشه',
      body: 'روی ملک در نقشه کلیک کنید و «پرونده در کنار نقشه» را بزنید.',
      href: '/dashboard/map',
      ctaLabel: 'باز کردن نقشه',
    },
  ],
  [UxPersona.GIS_ANALYST]: [
    {
      id: 'map',
      title: 'نقشه GIS',
      body: 'لایه‌ها، جستجو و پرونده در split view — بدون ترک نقشه.',
      href: '/dashboard/map',
      ctaLabel: 'نقشه',
    },
    {
      id: 'command_palette',
      title: 'Command Palette',
      body: 'Ctrl+K برای رفتن به لایه‌ها، محلات و جستجوی سراسری.',
    },
    {
      id: 'layers',
      title: 'مدیریت لایه',
      body: 'لایه‌های شهری را از صفحه لایه‌های نقشه فعال یا ویرایش کنید.',
      href: '/dashboard/layers',
      ctaLabel: 'لایه‌ها',
    },
  ],
  [UxPersona.MANAGER]: [
    {
      id: 'today',
      title: 'امروز من',
      body: 'شاخص‌های کلیدی و تأخیرهای عملیاتی را اینجا ببینید.',
      href: '/dashboard/today',
      ctaLabel: 'امروز من',
    },
    {
      id: 'command_palette',
      title: 'Command Palette',
      body: 'Ctrl+K برای دسترسی سریع به گزارش‌ها و داشبورد.',
    },
    {
      id: 'analytics',
      title: 'تحلیل و گزارش',
      body: 'گزارش‌های تحلیلی را با فیلترهای پیشرفته و preset ذخیره‌شده بررسی کنید.',
      href: '/dashboard/analytics',
      ctaLabel: 'تحلیل',
    },
  ],
  [UxPersona.ADMIN]: [
    {
      id: 'command_palette',
      title: 'Command Palette',
      body: 'Ctrl+K برای پرش بین کاربران، تنظیمات و امنیت.',
    },
    {
      id: 'settings',
      title: 'تنظیمات سامانه',
      body: 'برندینگ، منو و یکپارچه‌سازی را از تنظیمات مدیریت کنید.',
      href: '/dashboard/settings',
      ctaLabel: 'تنظیمات',
    },
    {
      id: 'security',
      title: 'مرکز امنیت',
      body: 'لاگ دسترسی PII و سیاست‌های امنیتی را بررسی کنید.',
      href: '/dashboard/security',
      ctaLabel: 'امنیت',
    },
  ],
  [UxPersona.ANALYST]: [
    {
      id: 'analytics',
      title: 'تحلیل داده',
      body: 'داشبورد تحلیلی نقطه شروع کار شماست.',
      href: '/dashboard/analytics',
      ctaLabel: 'تحلیل',
    },
    {
      id: 'command_palette',
      title: 'Command Palette',
      body: 'Ctrl+K برای جستجو و پرش بین گزارش‌ها.',
    },
    {
      id: 'saved_filters_analytics',
      title: 'فیلترهای ذخیره‌شده تحلیل',
      body: 'ترکیب محله، درآمد و بازه زمانی را ذخیره کنید و با یک کلیک روی داشبورد تحلیلی اعمال کنید.',
      href: '/dashboard/analytics',
      ctaLabel: 'تحلیل',
    },
  ],
  [UxPersona.DEFAULT]: [
    {
      id: 'today',
      title: 'شروع از «امروز من»',
      body: 'میز کار روزانه نقطه شروع پیشنهادی است.',
      href: '/dashboard/today',
      ctaLabel: 'امروز من',
    },
    {
      id: 'command_palette',
      title: 'Command Palette',
      body: 'Ctrl+K برای جستجو و ناوبری سریع.',
    },
    {
      id: 'households',
      title: 'فهرست خانوار',
      body: 'پرونده‌ها را با split view و فیلتر ذخیره‌شده مدیریت کنید.',
      href: '/dashboard/households',
      ctaLabel: 'خانوارها',
    },
  ],
};

export function getQuickActionsForPersona(persona: UxPersona): QuickActionConfig[] {
  return QUICK_ACTIONS[persona] ?? QUICK_ACTIONS[UxPersona.DEFAULT];
}

/** فاز ۳+ — عملیات Command Palette (بدون href) */
export const COMMAND_PALETTE_ACTION_SECTION = 'عملیات';

export type CommandPaletteActionId = 'toggle_theme';

export interface CommandPaletteActionMeta {
  id: CommandPaletteActionId;
  label: string;
  subtitle?: string;
  keywords: string[];
}

export function getCommandPaletteActions(theme: 'light' | 'dark'): CommandPaletteActionMeta[] {
  return [
    {
      id: 'toggle_theme',
      label: theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک',
      subtitle: `تم فعلی: ${theme === 'dark' ? 'تاریک' : 'روشن'}`,
      keywords: ['theme', 'تم', 'dark', 'light', 'تاریک', 'روشن', 'حالت'],
    },
  ];
}

export function getOnboardingStepsForPersona(persona: UxPersona): OnboardingStepConfig[] {
  return ONBOARDING_STEPS[persona] ?? ONBOARDING_STEPS[UxPersona.DEFAULT];
}

export function isOnboardingComplete(
  completedStepIds: string[],
  persona: UxPersona,
): boolean {
  const steps = getOnboardingStepsForPersona(persona);
  return steps.every((s) => completedStepIds.includes(s.id));
}
