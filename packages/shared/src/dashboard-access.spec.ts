import { Permission, ROLE_PERMISSIONS, SystemRole } from './index';
import {
  DASHBOARD_ROUTE_ACCESS,
  canViewDashboardPath,
  canWriteDashboardPath,
  collectRoutePermissionCodes,
  getDashboardRouteAccess,
  matchDashboardRoute,
  normalizeDashboardPath,
  type PermissionFns,
} from './dashboard-access';

function ctx(perms: string[]): PermissionFns {
  const set = new Set(perms);
  return {
    hasPermission: (p) => (Array.isArray(p) ? p.every((x) => set.has(x)) : set.has(p)),
    hasAnyPermission: (ps) => ps.some((x) => set.has(x)),
  };
}

const viewer = ctx(ROLE_PERMISSIONS[SystemRole.VIEWER]);
const social = ctx(ROLE_PERMISSIONS[SystemRole.SOCIAL_WORKER]);
const analyst = ctx(ROLE_PERMISSIONS[SystemRole.ANALYST]);
const orgAdmin = ctx(ROLE_PERMISSIONS[SystemRole.ORG_ADMIN]);

describe('dashboard route access', () => {
  it('normalizes trailing slash and query', () => {
    expect(normalizeDashboardPath('/dashboard/users/?x=1')).toBe('/dashboard/users');
    expect(normalizeDashboardPath('/dashboard')).toBe('/dashboard');
  });

  it('treats /dashboard as exact so it does not unlock nested routes', () => {
    expect(matchDashboardRoute('/dashboard')?.href).toBe('/dashboard');
    expect(matchDashboardRoute('/dashboard/users')?.href).toBe('/dashboard/users');
    expect(canViewDashboardPath('/dashboard/users', viewer)).toBe(false);
    expect(canViewDashboardPath('/dashboard', viewer)).toBe(true);
  });

  it('lets any authenticated user open today and profile', () => {
    const none = ctx([]);
    expect(canViewDashboardPath('/dashboard/today', none)).toBe(true);
    expect(canViewDashboardPath('/dashboard/profile', none)).toBe(true);
  });

  it('requires households:write for new case, read for detail', () => {
    expect(matchDashboardRoute('/dashboard/households/new')?.href).toBe('/dashboard/households/new');
    expect(canViewDashboardPath('/dashboard/households/new', viewer)).toBe(false);
    expect(canViewDashboardPath('/dashboard/households/new', social)).toBe(true);
    expect(canViewDashboardPath('/dashboard/households/abc-id', viewer)).toBe(true);
    expect(canWriteDashboardPath('/dashboard/households/abc-id', viewer)).toBe(false);
    expect(canWriteDashboardPath('/dashboard/households', social)).toBe(true);
  });

  it('hides users/settings from viewer and analyst', () => {
    expect(canViewDashboardPath('/dashboard/users', viewer)).toBe(false);
    expect(canViewDashboardPath('/dashboard/settings', analyst)).toBe(false);
    expect(canViewDashboardPath('/dashboard/users', orgAdmin)).toBe(true);
    expect(canWriteDashboardPath('/dashboard/users', orgAdmin)).toBe(true);
    expect(canViewDashboardPath('/dashboard/users/uuid-here', orgAdmin)).toBe(true);
    expect(canViewDashboardPath('/dashboard/users/uuid-here', viewer)).toBe(false);
  });

  it('restricts share links to share_views permissions, not reports:read', () => {
    expect(canViewDashboardPath('/dashboard/shares', viewer)).toBe(false);
    expect(canViewDashboardPath('/dashboard/shares', ctx(['reports:read']))).toBe(false);
    expect(canViewDashboardPath('/dashboard/shares', ctx(['share_views:read']))).toBe(true);
    expect(canWriteDashboardPath('/dashboard/shares', ctx(['share_views:read']))).toBe(false);
    expect(canWriteDashboardPath('/dashboard/shares', ctx(['share_views:manage']))).toBe(true);
  });

  it('allows map with either gis or dwelling read, write only with edit perms', () => {
    expect(canViewDashboardPath('/dashboard/map', ctx(['dwellings:read']))).toBe(true);
    expect(canViewDashboardPath('/dashboard/map', ctx(['gis_layers:read']))).toBe(true);
    expect(canWriteDashboardPath('/dashboard/map', ctx(['gis_layers:read']))).toBe(false);
    expect(canWriteDashboardPath('/dashboard/map', ctx(['dwellings:write']))).toBe(true);
  });

  it('denies unknown dashboard paths', () => {
    expect(matchDashboardRoute('/dashboard/not-a-page')).toBeUndefined();
    expect(canViewDashboardPath('/dashboard/not-a-page', orgAdmin)).toBe(false);
  });

  it('only references known Permission codes', () => {
    const known = new Set(Object.values(Permission));
    for (const rule of DASHBOARD_ROUTE_ACCESS) {
      for (const code of collectRoutePermissionCodes(rule)) {
        expect(known.has(code as Permission)).toBe(true);
      }
    }
  });

  it('keeps route hrefs unique', () => {
    const hrefs = DASHBOARD_ROUTE_ACCESS.map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('covers every sidebar path', () => {
    const sidebar = [
      '/dashboard/today',
      '/dashboard',
      '/dashboard/analytics',
      '/dashboard/activity',
      '/dashboard/security',
      '/dashboard/reports',
      '/dashboard/field',
      '/dashboard/referrals',
      '/dashboard/shares',
      '/dashboard/notifications',
      '/dashboard/programs',
      '/dashboard/neighborhoods',
      '/dashboard/forms',
      '/dashboard/operations',
      '/dashboard/households',
      '/dashboard/map',
      '/dashboard/layers',
      '/dashboard/users',
      '/dashboard/roles',
      '/dashboard/integrations',
      '/dashboard/settings',
    ];
    for (const href of sidebar) {
      expect(getDashboardRouteAccess(href)?.href).toBe(href);
      expect(canViewDashboardPath(href, orgAdmin)).toBe(true);
    }
  });

  it('matches nested program and neighborhood pages to parent rules', () => {
    expect(matchDashboardRoute('/dashboard/programs/abc')?.href).toBe('/dashboard/programs');
    expect(matchDashboardRoute('/dashboard/neighborhoods/abc')?.href).toBe('/dashboard/neighborhoods');
    expect(canWriteDashboardPath('/dashboard/programs/abc', viewer)).toBe(false);
    expect(canWriteDashboardPath('/dashboard/programs/abc', orgAdmin)).toBe(true);
  });

  it('lets field workers act with field:access and hides shares from analyst', () => {
    expect(canViewDashboardPath('/dashboard/field', social)).toBe(true);
    expect(canWriteDashboardPath('/dashboard/field', social)).toBe(true);
    expect(canViewDashboardPath('/dashboard/shares', analyst)).toBe(false);
    expect(canViewDashboardPath('/dashboard/shares', orgAdmin)).toBe(true);
    expect(canWriteDashboardPath('/dashboard/shares', orgAdmin)).toBe(true);
  });

  it('lets viewer read households and map but not write', () => {
    expect(canViewDashboardPath('/dashboard/households', viewer)).toBe(true);
    expect(canWriteDashboardPath('/dashboard/households', viewer)).toBe(false);
    expect(canViewDashboardPath('/dashboard/map', viewer)).toBe(true);
    expect(canWriteDashboardPath('/dashboard/map', viewer)).toBe(false);
    expect(canViewDashboardPath('/dashboard/operations', viewer)).toBe(false);
  });
});
