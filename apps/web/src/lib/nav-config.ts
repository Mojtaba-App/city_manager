import { getDashboardRouteAccess } from '@city-manager/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: string | string[];
  anyOf?: string[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

function navItem(href: string, label: string, icon: string): NavItem {
  const access = getDashboardRouteAccess(href);
  return {
    href,
    label,
    icon,
    permission: access?.permission,
    anyOf: access?.anyOf,
  };
}

export type SidebarNavOverride = {
  label?: string;
  icon?: string;
  hidden?: boolean;
  sortOrder?: number;
};

export type SidebarNavSetting = {
  items?: Record<string, SidebarNavOverride>;
  order?: string[];
};

/** Icons usable for sidebar items (must exist in NavIcons). */
export const SIDEBAR_ICON_OPTIONS = [
  'dashboard',
  'analytics',
  'activity',
  'security',
  'reports',
  'households',
  'map',
  'layers',
  'users',
  'roles',
  'integrations',
  'settings',
  'org',
  'dwellings',
  'neighborhood',
  'fabric',
  'trajectory',
  'plus-home',
  'shield-admin',
  'profile',
  'upload',
  'bell',
  'welcome',
] as const;

export const DEFAULT_NAV_GROUPS: NavGroup[] = [
  {
    title: 'عملیات',
    items: [
      navItem('/dashboard/today', 'امروز من', 'welcome'),
      navItem('/dashboard', 'داشبورد مدیریتی', 'dashboard'),
      navItem('/dashboard/analytics', 'تحلیل و گزارش', 'analytics'),
      navItem('/dashboard/activity', 'فعالیت‌های اخیر', 'activity'),
      navItem('/dashboard/security', 'مرکز امنیت', 'security'),
      navItem('/dashboard/reports', 'کاتالوگ گزارش‌ها', 'reports'),
    ],
  },
  {
    title: 'کانال‌ها',
    items: [
      navItem('/dashboard/field', 'کار میدانی', 'map'),
      navItem('/dashboard/referrals', 'ارجاع بین‌سازمانی', 'integrations'),
      navItem('/dashboard/shares', 'لینک‌های اشتراکی', 'upload'),
      navItem('/dashboard/notifications', 'مرکز اعلان‌ها', 'bell'),
    ],
  },
  {
    title: 'بازآفرینی',
    items: [
      navItem('/dashboard/programs', 'برنامه‌های بازآفرینی', 'fabric'),
      navItem('/dashboard/neighborhoods', 'داشبورد محلات', 'neighborhood'),
      navItem('/dashboard/forms', 'فرم‌ساز', 'settings'),
    ],
  },
  {
    title: 'داده‌ها',
    items: [
      navItem('/dashboard/operations', 'مرکز عملیات', 'activity'),
      navItem('/dashboard/households', 'خانوارها', 'households'),
      navItem('/dashboard/map', 'نقشه GIS', 'map'),
      navItem('/dashboard/layers', 'لایه‌های نقشه', 'layers'),
    ],
  },
  {
    title: 'سازمان',
    items: [
      navItem('/dashboard/users', 'کاربران', 'users'),
      navItem('/dashboard/roles', 'نقش‌ها و دسترسی‌ها', 'roles'),
      navItem('/dashboard/integrations', 'یکپارچه‌سازی', 'integrations'),
      navItem('/dashboard/settings', 'تنظیمات سیستم', 'settings'),
    ],
  },
];

export function flattenNavItems(groups: NavGroup[] = DEFAULT_NAV_GROUPS): NavItem[] {
  return groups.flatMap((g) => g.items);
}

export function applySidebarOverrides(
  groups: NavGroup[],
  overrides?: SidebarNavSetting | null,
): NavGroup[] {
  const map = overrides?.items ?? {};
  const order = overrides?.order;

  const mapped = groups.map((group) => ({
    ...group,
    items: group.items
      .map((item) => {
        const o = map[item.href];
        if (!o) return item;
        return {
          ...item,
          label: (o.label?.trim() || item.label),
          icon: (o.icon?.trim() || item.icon),
          hidden: Boolean(o.hidden),
          sortOrder: o.sortOrder,
        } as NavItem & { hidden?: boolean; sortOrder?: number };
      })
      .filter((item) => !(item as NavItem & { hidden?: boolean }).hidden),
  }));

  if (!order?.length) return mapped;

  const rank = new Map(order.map((href, i) => [href, i]));
  return mapped.map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => {
      const ra = rank.has(a.href) ? rank.get(a.href)! : 10_000;
      const rb = rank.has(b.href) ? rank.get(b.href)! : 10_000;
      return ra - rb;
    }),
  }));
}
