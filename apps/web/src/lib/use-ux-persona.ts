'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import {
  UxPersona,
  UX_PERSONA_LABELS,
  resolveUxPersona,
  getHouseholdTabsForPersona,
  getDefaultHouseholdTab,
  getTodayWidgetsForPersona,
  getHouseholdCtasForPersona,
  filterWidgetsByAccess,
  filterCtasByAccess,
  getDefaultLandingRoute,
  HouseholdDetailTab,
} from '@city-manager/shared';

export function useUxPersona() {
  const { profile, hasPermission, hasAnyPermission } = useAuth();

  return useMemo(() => {
    const roles = profile?.roles ?? [];
    const permissions = profile?.permissions ?? [];
    const persona = resolveUxPersona(roles, permissions);

    return {
      persona,
      personaLabel: UX_PERSONA_LABELS[persona],
      landingRoute: getDefaultLandingRoute(persona),
      householdTabs: getHouseholdTabsForPersona(persona),
      defaultHouseholdTab: getDefaultHouseholdTab(persona),
      todayWidgets: filterWidgetsByAccess(
        getTodayWidgetsForPersona(persona),
        hasPermission,
        hasAnyPermission,
      ),
      householdCtas: filterCtasByAccess(
        getHouseholdCtasForPersona(persona),
        hasPermission,
        hasAnyPermission,
      ),
    };
  }, [profile, hasPermission, hasAnyPermission]);
}

export type { UxPersona, HouseholdDetailTab };
