/** مجوز دیدن/نوشتن هر مسیر داشبورد — منبع واحد برای منو، RouteGate و دکمه‌ها */

export interface DashboardRouteAccess {
  href: string;
  /** فقط همین مسیر؛ پیشوند زیرمسیرها را نگیرد (مثل /dashboard) */
  exact?: boolean;
  /** بدون مجوز خاص؛ هر کاربر واردشده */
  publicToAuthenticated?: boolean;
  /** همهٔ این مجوزها لازم است */
  permission?: string | string[];
  /** حداقل یکی */
  anyOf?: string[];
  writePermission?: string | string[];
  writeAnyOf?: string[];
}

export interface PermissionFns {
  hasPermission: (p: string | string[]) => boolean;
  hasAnyPermission: (ps: string[]) => boolean;
}

export const DASHBOARD_ROUTE_ACCESS: DashboardRouteAccess[] = [
  { href: '/dashboard/today', publicToAuthenticated: true },
  { href: '/dashboard/profile', publicToAuthenticated: true, exact: true },
  { href: '/dashboard', permission: 'org:read', exact: true },
  { href: '/dashboard/analytics', permission: 'reports:read', writePermission: 'reports:write' },
  { href: '/dashboard/activity', permission: 'audit:read' },
  {
    href: '/dashboard/security',
    permission: 'security:read',
    writeAnyOf: ['security:write', 'secrets:manage', 'oauth:manage'],
  },
  { href: '/dashboard/reports', permission: 'reports:read', writePermission: 'reports:write' },
  { href: '/dashboard/field', permission: 'field:access', writePermission: 'field:access' },
  { href: '/dashboard/referrals', permission: 'referrals:read', writePermission: 'referrals:write' },
  {
    href: '/dashboard/shares',
    anyOf: ['share_views:read', 'share_views:manage'],
    writePermission: 'share_views:manage',
  },
  {
    href: '/dashboard/notifications',
    permission: 'notifications:read',
    writePermission: 'notifications:write',
  },
  {
    href: '/dashboard/programs',
    permission: 'neighborhoods:read',
    writePermission: 'neighborhoods:write',
  },
  {
    href: '/dashboard/neighborhoods',
    permission: 'neighborhoods:read',
    writePermission: 'neighborhoods:write',
  },
  { href: '/dashboard/forms', permission: 'forms:read', writePermission: 'forms:write' },
  {
    href: '/dashboard/operations',
    permission: 'operations:read',
    writeAnyOf: ['operations:write', 'operations:assign'],
  },
  { href: '/dashboard/households/new', permission: 'households:write', exact: true },
  {
    href: '/dashboard/households',
    permission: 'households:read',
    writePermission: 'households:write',
  },
  {
    href: '/dashboard/map',
    anyOf: ['gis_layers:read', 'dwellings:read'],
    writeAnyOf: ['dwellings:write', 'gis_layers:write', 'neighborhoods:write', 'fabrics:write'],
  },
  {
    href: '/dashboard/layers',
    permission: 'gis_layers:read',
    writeAnyOf: ['gis_layers:write', 'neighborhoods:write', 'fabrics:write', 'dwellings:write'],
  },
  { href: '/dashboard/users', permission: 'users:read', writePermission: 'users:write' },
  { href: '/dashboard/roles', permission: 'roles:read', writePermission: 'roles:write' },
  {
    href: '/dashboard/integrations',
    permission: 'integration:read',
    writeAnyOf: ['integration:write', 'integration:execute'],
  },
  { href: '/dashboard/settings', permission: 'settings:read', writePermission: 'settings:write' },
];

export function normalizeDashboardPath(pathname: string): string {
  const path = String(pathname ?? '').split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

function pathMatchesRule(path: string, rule: DashboardRouteAccess): boolean {
  if (rule.exact) return path === rule.href;
  return path === rule.href || path.startsWith(`${rule.href}/`);
}

export function matchDashboardRoute(
  pathname: string,
  rules: DashboardRouteAccess[] = DASHBOARD_ROUTE_ACCESS,
): DashboardRouteAccess | undefined {
  const path = normalizeDashboardPath(pathname);
  const matches = rules.filter((r) => pathMatchesRule(path, r));
  if (!matches.length) return undefined;
  return matches.reduce((best, r) => (r.href.length > best.href.length ? r : best));
}

export function getDashboardRouteAccess(
  href: string,
  rules: DashboardRouteAccess[] = DASHBOARD_ROUTE_ACCESS,
): DashboardRouteAccess | undefined {
  const path = normalizeDashboardPath(href);
  return rules.find((r) => r.href === path);
}

export function canViewRouteAccess(
  rule: DashboardRouteAccess | undefined,
  ctx: PermissionFns,
): boolean {
  if (!rule) return false;
  if (rule.publicToAuthenticated) return true;
  if (rule.anyOf?.length) return ctx.hasAnyPermission(rule.anyOf);
  if (rule.permission) return ctx.hasPermission(rule.permission);
  return false;
}

export function canWriteRouteAccess(
  rule: DashboardRouteAccess | undefined,
  ctx: PermissionFns,
): boolean {
  if (!rule) return false;
  if (rule.writeAnyOf?.length) return ctx.hasAnyPermission(rule.writeAnyOf);
  if (rule.writePermission) return ctx.hasPermission(rule.writePermission);
  return false;
}

export function canViewDashboardPath(pathname: string, ctx: PermissionFns): boolean {
  return canViewRouteAccess(matchDashboardRoute(pathname), ctx);
}

export function canWriteDashboardPath(pathname: string, ctx: PermissionFns): boolean {
  return canWriteRouteAccess(matchDashboardRoute(pathname), ctx);
}

export function collectRoutePermissionCodes(rule: DashboardRouteAccess): string[] {
  const out: string[] = [];
  const push = (v?: string | string[]) => {
    if (!v) return;
    if (Array.isArray(v)) out.push(...v);
    else out.push(v);
  };
  push(rule.permission);
  if (rule.anyOf) out.push(...rule.anyOf);
  push(rule.writePermission);
  if (rule.writeAnyOf) out.push(...rule.writeAnyOf);
  return out;
}
