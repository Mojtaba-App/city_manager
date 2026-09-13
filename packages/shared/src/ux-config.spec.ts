import {
  UxPersona,
  resolveUxPersona,
  getHouseholdTabsForPersona,
  getDefaultHouseholdTab,
  getTodayWidgetsForPersona,
  filterWidgetsByAccess,
  buildMapUrl,
  buildHouseholdUrl,
  resolveCtaHref,
  shouldOpenMapFirst,
  getDefaultLandingRoute,
  resolvePostLoginRoute,
  buildMapCaseUrl,
  buildHouseholdSplitUrl,
  getCasePresentationMode,
  getQuickActionsForPersona,
  getOnboardingStepsForPersona,
  isOnboardingComplete,
  getCommandPaletteActions,
  COMMAND_PALETTE_ACTION_SECTION,
} from './ux-config';

describe('ux-config', () => {
  it('resolves social worker persona', () => {
    expect(resolveUxPersona(['social_worker'], [])).toBe(UxPersona.SOCIAL_WORKER);
  });

  it('resolves field worker when field permission without manager', () => {
    expect(resolveUxPersona(['social_worker'], ['field:access'])).toBe(UxPersona.FIELD_WORKER);
  });

  it('admin takes priority over field', () => {
    expect(resolveUxPersona(['org_admin'], ['field:access'])).toBe(UxPersona.ADMIN);
  });

  it('orders tabs with operations first for social worker', () => {
    const tabs = getHouseholdTabsForPersona(UxPersona.SOCIAL_WORKER);
    expect(tabs[0]).toBe('operations');
  });

  it('default tab is operations for social worker', () => {
    expect(getDefaultHouseholdTab(UxPersona.SOCIAL_WORKER)).toBe('operations');
  });

  it('landing route for social worker is today', () => {
    expect(getDefaultLandingRoute(UxPersona.SOCIAL_WORKER)).toBe('/dashboard/today');
  });

  it('landing route for gis analyst is map', () => {
    expect(getDefaultLandingRoute(UxPersona.GIS_ANALYST)).toBe('/dashboard/map');
  });

  it('filters widgets by permission', () => {
    const widgets = getTodayWidgetsForPersona(UxPersona.SOCIAL_WORKER);
    const filtered = filterWidgetsByAccess(widgets, (p) => p === 'operations:read', () => false);
    expect(filtered.some((w) => w.id === 'my_tasks')).toBe(true);
    expect(filtered.some((w) => w.id === 'notifications')).toBe(false);
  });

  it('builds map url with dwelling param', () => {
    expect(buildMapUrl({ dwellingId: 'd1' })).toBe('/dashboard/map?dwelling=d1');
  });

  it('builds household url with tab', () => {
    expect(buildHouseholdUrl('h1', 'operations')).toBe('/dashboard/households/h1?tab=operations');
  });

  it('resolves cta href for trajectory', () => {
    expect(resolveCtaHref('/dashboard/households/:householdId/trajectory', { householdId: 'h1' }))
      .toBe('/dashboard/households/h1/trajectory');
  });

  it('should open map first for dwelling', () => {
    expect(shouldOpenMapFirst('dwelling')).toBe(true);
    expect(shouldOpenMapFirst('household')).toBe(false);
  });

  it('resolves post-login route from roles and permissions', () => {
    expect(resolvePostLoginRoute(['social_worker'], [])).toBe('/dashboard/today');
    expect(resolvePostLoginRoute(['social_worker'], ['field:access'])).toBe('/dashboard/field');
    expect(resolvePostLoginRoute(['org_admin'], [])).toBe('/dashboard');
  });

  it('builds map case drawer url', () => {
    expect(buildMapCaseUrl({ householdId: 'h1', dwellingId: 'd1', tab: 'operations' }))
      .toBe('/dashboard/map?dwelling=d1&case=h1&tab=operations');
  });

  it('builds household split url', () => {
    expect(buildHouseholdSplitUrl('h1', 'members')).toBe('/dashboard/households?case=h1&tab=members');
  });

  it('prefers split on households list', () => {
    expect(getCasePresentationMode(UxPersona.SOCIAL_WORKER, 'households_list')).toBe('split');
  });

  it('prefers drawer on map for gis analyst', () => {
    expect(getCasePresentationMode(UxPersona.GIS_ANALYST, 'map')).toBe('drawer');
  });

  it('returns quick actions for social worker', () => {
    const actions = getQuickActionsForPersona(UxPersona.SOCIAL_WORKER);
    expect(actions.some((a) => a.id === 'households')).toBe(true);
  });

  it('returns onboarding steps per persona', () => {
    const steps = getOnboardingStepsForPersona(UxPersona.SOCIAL_WORKER);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.some((s) => s.id === 'command_palette')).toBe(true);
  });

  it('detects onboarding completion', () => {
    const steps = getOnboardingStepsForPersona(UxPersona.DEFAULT);
    const ids = steps.map((s) => s.id);
    expect(isOnboardingComplete(ids, UxPersona.DEFAULT)).toBe(true);
    expect(isOnboardingComplete([], UxPersona.DEFAULT)).toBe(false);
  });

  it('returns palette actions with theme-aware labels', () => {
    const dark = getCommandPaletteActions('dark');
    expect(dark[0].id).toBe('toggle_theme');
    expect(dark[0].label).toContain('روشن');
    const light = getCommandPaletteActions('light');
    expect(light[0].label).toContain('تاریک');
    expect(COMMAND_PALETTE_ACTION_SECTION).toBe('عملیات');
  });
});
