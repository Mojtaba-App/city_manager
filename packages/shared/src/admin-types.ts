export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدیر کل سیستم',
  org_admin: 'مدیر سازمان',
  manager: 'مدیر',
  social_worker: 'مددکار اجتماعی',
  analyst: 'تحلیل‌گر',
  viewer: 'بازدیدکننده',
};

export const PERMISSION_LABELS: Record<string, string> = {
  'users:read': 'مشاهده کاربران',
  'users:write': 'ویرایش کاربران',
  'users:delete': 'حذف کاربران',
  'roles:read': 'مشاهده نقش‌ها',
  'roles:write': 'ویرایش نقش‌ها',
  'audit:read': 'مشاهده ممیزی',
  'org:read': 'مشاهده سازمان',
  'org:write': 'ویرایش سازمان',
  'households:read': 'مشاهده خانوار',
  'households:write': 'ویرایش خانوار',
  'members:read': 'مشاهده اعضا',
  'members:write': 'ویرایش اعضا',
  'gis_layers:read': 'مشاهده لایه‌ها',
  'gis_layers:write': 'ویرایش لایه‌ها',
  'settings:read': 'مشاهده تنظیمات',
  'settings:write': 'ویرایش تنظیمات',
  'reports:read': 'مشاهده گزارش‌ها',
  'reports:write': 'مدیریت گزارش‌ها',
  'integration:read': 'مشاهده یکپارچه‌سازی',
  'integration:write': 'تنظیم یکپارچه‌سازی',
  'integration:execute': 'اجرای همگام‌سازی',
  'trajectory:read': 'مشاهده خط سیر',
  'trajectory:write': 'ثبت خط سیر',
};

export interface AdminDashboardStats {
  usersTotal: number;
  usersActive: number;
  householdsTotal: number;
  householdsActive: number;
  dwellingsTotal: number;
  neighborhoodsTotal: number;
  fabricsTotal: number;
  trajectoryEventsTotal: number;
  recentActivityCount: number;
}

export interface ReportDefinition {
  id: string;
  code: string;
  title: string;
  description: string;
  category: 'household' | 'gis' | 'trajectory' | 'ops';
  format: 'table' | 'chart' | 'export';
  permission?: string;
}

export const DEFAULT_REPORTS: ReportDefinition[] = [
  {
    id: 'rpt-hh-status',
    code: 'households_by_status',
    title: 'خانوارها بر اساس وضعیت',
    description: 'توزیع پرونده‌های خانوار بر اساس وضعیت جاری',
    category: 'household',
    format: 'chart',
    permission: 'reports:read',
  },
  {
    id: 'rpt-hh-members',
    code: 'household_member_counts',
    title: 'تعداد اعضای خانوار',
    description: 'میانگین و توزیع اندازه خانوار',
    category: 'household',
    format: 'table',
  },
  {
    id: 'rpt-gis-fabrics',
    code: 'fabric_coverage',
    title: 'پوشش بافت‌های فرسوده',
    description: 'آمار لایه‌های بافت و مساحت',
    category: 'gis',
    format: 'table',
  },
  {
    id: 'rpt-traj-events',
    code: 'trajectory_event_types',
    title: 'رویدادهای خط سیر',
    description: 'فراوانی انواع رویدادهای تحول',
    category: 'trajectory',
    format: 'chart',
  },
  {
    id: 'rpt-ops-audit',
    code: 'recent_audit',
    title: 'فعالیت‌های عملیاتی',
    description: 'خلاصه لاگ ممیزی ۳۰ روز اخیر',
    category: 'ops',
    format: 'export',
  },
];

/** قالب‌های گزارش سفارشی قابل ثبت در رجیستری (بدون SQL آزاد از کلاینت) */
export const CUSTOM_REPORT_TEMPLATES: ReportDefinition[] = [
  {
    id: 'rpt-nbhd-hh',
    code: 'neighborhood_household_counts',
    title: 'خانوار به تفکیک محله',
    description: 'تعداد پرونده خانوار در هر محله هدف',
    category: 'household',
    format: 'table',
    permission: 'reports:read',
  },
  {
    id: 'rpt-referral-status',
    code: 'referrals_by_status',
    title: 'ارجاع‌ها بر اساس وضعیت',
    description: 'توزیع ارجاع‌های بین‌سازمانی',
    category: 'ops',
    format: 'chart',
    permission: 'reports:read',
  },
];
