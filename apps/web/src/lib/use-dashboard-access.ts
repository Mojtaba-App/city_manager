'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  canViewDashboardPath,
  canWriteDashboardPath,
  matchDashboardRoute,
} from '@city-manager/shared';
import { useAuth } from '@/lib/auth';

export function useDashboardAccess(pathname?: string) {
  const current = usePathname();
  const { hasPermission, hasAnyPermission } = useAuth();
  const target = pathname ?? current ?? '';

  return useMemo(() => {
    const ctx = { hasPermission, hasAnyPermission };
    return {
      rule: matchDashboardRoute(target),
      canView: canViewDashboardPath(target, ctx),
      canWrite: canWriteDashboardPath(target, ctx),
    };
  }, [target, hasPermission, hasAnyPermission]);
}
